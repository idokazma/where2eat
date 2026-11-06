import pytest
from cost_ledger import CostLedger, BudgetExceeded

@pytest.fixture
def ledger(tmp_path):
    return CostLedger(str(tmp_path/'cost.db'),budget=1,opening=0)

def test_reservation_prevents_concurrent_overspend(ledger):
    ledger.reserve('r','gemini-2.5-flash',.8,'a')
    with pytest.raises(BudgetExceeded):ledger.reserve('r','gemini-2.5-flash',.3,'b')

def test_usage_settlement_is_idempotent_and_includes_thinking(ledger):
    ledger.reserve('run','gemini-2.5-flash',.8,'a')
    usage={'promptTokenCount':1000,'candidatesTokenCount':100,'thoughtsTokenCount':50}
    ledger.settle_gemini('a',usage)
    ledger.settle_gemini('a',usage)
    s=ledger.summary();assert s['estimated_usd']==pytest.approx(.000675)
    assert len(s['runs'])==1 and s['runs'][0]['run_id']=='run'

def test_unknown_initial_spend_is_fail_closed_in_strict_mode(tmp_path,monkeypatch):
    monkeypatch.setenv('COST_REQUIRE_VERIFIED_OPENING','true')
    ledger=CostLedger(str(tmp_path/'x.db'),budget=10,opening=None)
    with pytest.raises(BudgetExceeded):ledger.reserve('r','places_photo',.007,'a')

def test_reserve_unknown_opening_default_allows_and_alerts(tmp_path,monkeypatch):
    monkeypatch.delenv('COST_REQUIRE_VERIFIED_OPENING',raising=False)
    ledger=CostLedger(str(tmp_path/'x.db'),budget=10,opening=None)
    ledger.reserve('r','places_photo',.007,'a')
    s=ledger.summary()
    assert s['opening_spend_verified'] is False and s['alert'] is True and s['stopped'] is False

def test_reserve_unknown_opening_still_enforces_budget(tmp_path,monkeypatch):
    monkeypatch.delenv('COST_REQUIRE_VERIFIED_OPENING',raising=False)
    ledger=CostLedger(str(tmp_path/'x.db'),budget=1,opening=None)
    with pytest.raises(BudgetExceeded):ledger.reserve('r','gemini-2.5-flash',1.5,'a')

def test_reserve_stale_prices_warns_instead_of_blocking(ledger,monkeypatch):
    monkeypatch.setattr('cost_ledger.PRICE_DATE','2020-01-01')
    ledger.reserve('r','places_photo',.007,'a')
    s=ledger.summary();assert s['price_review_overdue'] is True and s['alert'] is True

def test_record_never_blocks_when_over_budget(ledger):
    ledger.reserve('r','gemini-2.5-flash',.99,'a')
    ledger.record('r','places_photo',.5)
    s=ledger.summary();assert s['estimated_usd']==pytest.approx(1.49) and s['stopped'] is True

def test_record_swallows_ledger_storage_errors(tmp_path):
    ledger=CostLedger(str(tmp_path/'x.db'),budget=1,opening=0)
    ledger.path=str(tmp_path/'missing-dir'/'x.db')
    ledger.record('r','places_photo',.007)  # must not raise

def test_async_places_request_unenforced_sends_when_over_budget(tmp_path,monkeypatch):
    import asyncio
    from unittest.mock import AsyncMock,patch
    from cost_ledger import async_places_request
    ledger=CostLedger(str(tmp_path/'x.db'),budget=0,opening=0)
    client=AsyncMock();client.get.return_value='img'
    with patch('cost_ledger.CostLedger',return_value=ledger):
        assert asyncio.run(async_places_request(client,'https://places.googleapis.com/v1/places/x/photos/y/media',enforce=False))=='img'
    assert ledger.summary()['skus'][0]['sku']=='places_photo'

def test_unknown_model_refused(ledger):
    with pytest.raises(BudgetExceeded):ledger.reserve('r','unknown',.01,'a')

def test_transport_failure_remains_reserved(ledger):
    ledger.reserve('run','places_photo',.007,'a')
    assert ledger.summary()['unsettled_calls']==1
    assert ledger.summary()['estimated_usd']==.007

def test_alert_threshold(ledger):
    ledger.reserve('run','places_photo',.85,'a')
    assert ledger.summary()['alert'] is True

def test_places_wrapper_does_not_send_when_budget_unknown(tmp_path,monkeypatch):
    from unittest.mock import patch
    from cost_ledger import places_request
    monkeypatch.setenv('DATABASE_DIR',str(tmp_path));monkeypatch.delenv('COST_OPENING_MONTH',raising=False);monkeypatch.setenv('COST_REQUIRE_VERIFIED_OPENING','true')
    with patch('requests.get') as get:
        with pytest.raises(BudgetExceeded):places_request('get','https://places.googleapis.com/v1/places/x')
        get.assert_not_called()

def test_ledger_contains_no_url_key_prompt_or_response(ledger):
    ledger.reserve('run','places_photo',.007,'a');ledger.settle_places('a')
    with ledger._db() as c:
        row=dict(c.execute('SELECT * FROM calls').fetchone())
    assert set(row)=={'id','run_id','month','sku','reserved','actual','units','price_date','created_at'}

def test_gemini_budget_stop_prevents_network(monkeypatch,tmp_path):
    import sys,logging
    from unittest.mock import Mock,MagicMock,patch
    from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer
    monkeypatch.setenv('DATABASE_DIR',str(tmp_path));monkeypatch.delenv('COST_OPENING_MONTH',raising=False);monkeypatch.setenv('COST_REQUIRE_VERIFIED_OPENING','true')
    a=UnifiedRestaurantAnalyzer.__new__(UnifiedRestaurantAnalyzer);a.logger=logging.getLogger('test');a.config=Mock();a.config.get_active_model.return_value='gemini-2.5-flash';a.config.get_active_max_tokens.return_value=10;a.client=Mock();a._get_system_prompt=lambda:'system'
    with patch.dict(sys.modules,{'google':MagicMock(),'google.genai':MagicMock(),'google.genai.types':MagicMock()}):
        with pytest.raises(BudgetExceeded):a._call_gemini('prompt')
    a.client.models.generate_content.assert_not_called()

def test_partial_usage_does_not_release_reservation(ledger):
    ledger.reserve('r','gemini-2.5-flash',.8,'a');ledger.settle_gemini('a',{'promptTokenCount':100})
    assert ledger.summary()['estimated_usd']==.8

def test_atomic_concurrent_reservations(ledger):
    from concurrent.futures import ThreadPoolExecutor
    def reserve(i):
        try:ledger.reserve('r','places_photo',.6,str(i));return True
        except BudgetExceeded:return False
    with ThreadPoolExecutor(max_workers=2) as pool:assert sum(pool.map(reserve,range(2)))==1

def test_places_success_records_each_attempt(ledger):
    from unittest.mock import Mock,patch
    from cost_ledger import places_request
    with patch('cost_ledger.CostLedger',return_value=ledger),patch('requests.get',return_value=Mock(status_code=200)):
        places_request('get','https://places.googleapis.com/v1/places/x')
        places_request('get','https://places.googleapis.com/v1/places/x')
    s=ledger.summary();assert s['estimated_usd']==.05 and s['skus'][0]['attempts']==2

def test_places_exception_retains_reservation(ledger):
    from unittest.mock import patch
    from cost_ledger import places_request
    with patch('cost_ledger.CostLedger',return_value=ledger),patch('requests.get',side_effect=TimeoutError):
        with pytest.raises(TimeoutError):places_request('get','https://places.googleapis.com/v1/places/x')
    assert ledger.summary()['unsettled_calls']==1
