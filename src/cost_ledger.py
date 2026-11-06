"""Local gross-cost estimates, NOT provider balance or billing enforcement.

No free-tier/credits/volume discounts are subtracted. Every outbound attempt gets
its own ID; recording one response twice is idempotent. Unknown outcome retains
its reservation. Monthly opening spend must be explicitly configured for the
current UTC month. If it is missing, spend is assumed to start at 0 and the
dashboard raises an "unverified" alert; set COST_REQUIRE_VERIFIED_OPENING=true
to refuse paid calls instead. Stale prices raise an alert, never a stop.

Public, user-facing calls (the photo proxy that serves site images) are only
recorded via enforce=False: they are never refused by the budget.
"""
import logging
import contextvars
import math
from contextlib import contextmanager
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

PRICE_DATE='2026-11-06'
PRICE_SOURCES=['https://ai.google.dev/gemini-api/docs/pricing','https://developers.google.com/maps/billing-and-pricing/pricing']
# Conservative gross list rates per request. Legacy details include contact and
# atmosphere additions; no free allowance is assumed. Price review required.
RATES={'places_search_new':.040,'places_details_new':.025,'places_photo':.007,
       'places_search_legacy':.032,'places_details_legacy':.025}
MODELS={'gemini-2.5-flash':{'input':.30/1_000_000,'output':2.50/1_000_000}}
run_id=contextvars.ContextVar('cost_run_id',default=None)
PRICE_REVIEW_DAYS=90
logger=logging.getLogger(__name__)

def _strict_opening():
    return os.getenv('COST_REQUIRE_VERIFIED_OPENING','').lower() in {'1','true','yes'}

def price_review_overdue():
    return (datetime.now(timezone.utc).date()-datetime.fromisoformat(PRICE_DATE).date()).days>PRICE_REVIEW_DAYS

class BudgetExceeded(RuntimeError):pass

class CostLedger:
    def __init__(self,path=None,budget=None,opening='env'):
        self.path=path or str(Path(os.getenv('DATABASE_DIR',str(Path(__file__).resolve().parent.parent/'data')))/'cost_estimates.db')
        Path(self.path).parent.mkdir(parents=True,exist_ok=True)
        self.budget=float(budget if budget is not None else os.getenv('COST_MONTHLY_BUDGET_USD','10'))
        if not math.isfinite(self.budget) or self.budget<0:raise ValueError('Invalid budget')
        self.month=datetime.now(timezone.utc).strftime('%Y-%m')
        self.opening=(float(os.environ['COST_OPENING_SPEND_USD']) if os.getenv('COST_OPENING_MONTH')==self.month and 'COST_OPENING_SPEND_USD' in os.environ else None) if opening=='env' else opening
        if self.opening is not None and (not math.isfinite(self.opening) or self.opening<0):raise ValueError('Opening spend cannot be negative')
        with self._db() as c:
            c.execute('CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,month TEXT NOT NULL,sku TEXT NOT NULL,reserved REAL NOT NULL,actual REAL,units TEXT,price_date TEXT NOT NULL,created_at TEXT NOT NULL)')
            c.execute('CREATE TABLE IF NOT EXISTS openings(month TEXT PRIMARY KEY,usd REAL NOT NULL)')
            if self.opening is not None:c.execute('INSERT OR IGNORE INTO openings(month,usd) VALUES(?,?)',(self.month,self.opening))
    @contextmanager
    def _db(self):
        c=sqlite3.connect(self.path,timeout=30);c.row_factory=sqlite3.Row
        try:
            yield c
            c.commit()
        except Exception:
            c.rollback()
            raise
        finally:
            c.close()
    def reserve(self,run,sku,amount,attempt=None):
        if price_review_overdue():
            logger.warning('Cost ledger prices are older than %s days; review src/cost_ledger.py',PRICE_REVIEW_DAYS)
        if sku not in RATES and sku not in MODELS:raise BudgetExceeded('Unpriced model/SKU; configure a reviewed price before calling provider')
        if not math.isfinite(amount) or amount<0:raise ValueError('Negative reservation')
        attempt=attempt or str(uuid.uuid4())
        with self._db() as c:
            c.execute('BEGIN IMMEDIATE')
            if c.execute('SELECT id FROM calls WHERE id=?',(attempt,)).fetchone():return attempt
            o=c.execute('SELECT usd FROM openings WHERE month=?',(self.month,)).fetchone()
            if o is None and _strict_opening():raise BudgetExceeded('Current-month opening spend unverified; configure COST_OPENING_MONTH and COST_OPENING_SPEND_USD')
            opening=o[0] if o else 0
            spent=c.execute('SELECT COALESCE(SUM(COALESCE(actual,reserved)),0) FROM calls WHERE month=?',(self.month,)).fetchone()[0]
            if opening+spent+amount>self.budget:raise BudgetExceeded('Estimated monthly budget would be exceeded')
            c.execute('INSERT INTO calls VALUES(?,?,?,?,?,NULL,NULL,?,?)',(attempt,run or run_id.get() or 'unassigned',self.month,sku,amount,PRICE_DATE,datetime.now(timezone.utc).isoformat()))
        return attempt
    def record(self,run,sku,amount):
        """Record a settled attempt without any budget check. Never raises."""
        try:
            with self._db() as c:
                c.execute('INSERT INTO calls VALUES(?,?,?,?,?,?,?,?,?)',(str(uuid.uuid4()),run or run_id.get() or 'unassigned',self.month,sku,amount,amount,'{"requests":1}',PRICE_DATE,datetime.now(timezone.utc).isoformat()))
        except Exception as e:
            logger.warning('Cost ledger record failed: %s',type(e).__name__)
    def settle_gemini(self,attempt,usage):
        if not usage:return # retain worst-case reservation when metadata is unavailable
        def present(*keys):
            return any((usage.get(k) if isinstance(usage,dict) else getattr(usage,k,None)) is not None for k in keys)
        if not present('promptTokenCount','prompt_token_count') or not present('candidatesTokenCount','candidates_token_count'):
            return # partial metadata must not release an uncertain reservation
        def n(*keys):
            for k in keys:
                v=usage.get(k) if isinstance(usage,dict) else getattr(usage,k,None)
                if v is not None:return max(0,int(v))
            return 0
        units={'input':n('promptTokenCount','prompt_token_count'),'output':n('candidatesTokenCount','candidates_token_count')+n('thoughtsTokenCount','thoughts_token_count')}
        with self._db() as c:
            row=c.execute('SELECT sku,actual FROM calls WHERE id=?',(attempt,)).fetchone()
            if not row:raise ValueError('Missing reservation')
            if row['actual'] is not None:return
            rate=MODELS[row['sku']];cost=units['input']*rate['input']+units['output']*rate['output']
            c.execute('UPDATE calls SET actual=?,units=? WHERE id=?',(cost,json.dumps(units),attempt))
    def settle_places(self,attempt):
        with self._db() as c:c.execute('UPDATE calls SET actual=reserved,units=? WHERE id=? AND actual IS NULL',('{"requests":1}',attempt))
    def summary(self):
        with self._db() as c:
            o=c.execute('SELECT usd FROM openings WHERE month=?',(self.month,)).fetchone();opening=o[0] if o else None
            calls=c.execute('SELECT COALESCE(SUM(COALESCE(actual,reserved)),0),SUM(actual IS NULL) FROM calls WHERE month=?',(self.month,)).fetchone()
            runs=[dict(r) for r in c.execute('SELECT run_id,COUNT(*) as attempts,SUM(COALESCE(actual,reserved)) as estimated_usd FROM calls WHERE month=? GROUP BY run_id',(self.month,))]
            skus=[dict(r) for r in c.execute('SELECT sku,COUNT(*) as attempts,SUM(COALESCE(actual,reserved)) as estimated_usd FROM calls WHERE month=? GROUP BY sku',(self.month,))]
        total=(opening or 0)+calls[0];overdue=price_review_overdue()
        stopped=total>=self.budget or (opening is None and _strict_opening())
        return {'label':'Estimate, not provider balance','timezone':'UTC','month':self.month,'opening_spend_verified':opening is not None,'opening_usd':opening,'estimated_usd':total,'budget_usd':self.budget,'alert':opening is None or overdue or total>=self.budget*.8,'stopped':stopped,'price_review_overdue':overdue,'public_photos_enforced':False,'unsettled_calls':calls[1] or 0,'runs':runs,'skus':skus,'price_date':PRICE_DATE,'price_sources':PRICE_SOURCES,'coverage':'Instrumented Gemini analyzer, Places enricher and API proxies only; public photo proxy is recorded but never blocked; excludes unrelated keys/clients and historical unrecorded spend'}

def places_request(method,url,**kwargs):
    """Count one network attempt. Never persist URL, key, query, body or response."""
    import requests
    ledger=CostLedger();sku=places_sku(url);attempt=ledger.reserve(run_id.get(),sku,RATES[sku])
    response=getattr(requests,method)(url,**kwargs)
    ledger.settle_places(attempt);return response

def places_sku(url):
    if '/media' in url or '/photo' in url:return 'places_photo'
    new='places.googleapis.com' in url
    return ('places_search_' if 'search' in url.lower() else 'places_details_')+('new' if new else 'legacy')

async def async_places_request(client,url,enforce=True,**kwargs):
    """enforce=False is for public, user-facing traffic: record, never refuse."""
    sku=places_sku(url)
    if not enforce:
        response=await client.get(url,**kwargs)
        try:CostLedger().record(run_id.get() or 'public-photo-proxy',sku,RATES[sku])
        except Exception as e:logger.warning('Cost ledger unavailable: %s',type(e).__name__)
        return response
    ledger=CostLedger();attempt=ledger.reserve(run_id.get(),sku,RATES[sku])
    response=await client.get(url,**kwargs);ledger.settle_places(attempt);return response
