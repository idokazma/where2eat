"""The public photo proxy refuses new paid fetches when the budget is stopped; saved images keep serving."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'api'))
from unittest.mock import AsyncMock,patch
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('DATABASE_DIR',str(tmp_path));monkeypatch.setenv('GOOGLE_PLACES_API_KEY','dummy')
    monkeypatch.setenv('COST_REQUIRE_VERIFIED_OPENING','true');monkeypatch.setenv('COST_MONTHLY_BUDGET_USD','0')
    monkeypatch.delenv('COST_OPENING_MONTH',raising=False)
    from routers.photos import router as photos
    from routers.places import router as places
    app=FastAPI();app.include_router(photos);app.include_router(places);return TestClient(app)

def _img():
    return httpx.Response(200,content=b'img',headers={'content-type':'image/jpeg'},request=httpx.Request('GET','https://x'))

@pytest.mark.parametrize('path',['/api/photos/places/P/photos/X?maxwidth=400','/api/places/photo/REF?maxwidth=400'])
def test_get_photo_budget_stopped_makes_no_paid_call(client,path):
    with patch('httpx.AsyncClient.get',new=AsyncMock(return_value=_img())) as get:
        r=client.get(path)
    assert r.status_code==404 and not get.called and r.headers['cache-control']=='no-store'

def test_saved_photo_still_served_when_budget_stopped(client,tmp_path):
    import hashlib
    from routers import photos as ph
    ref='places/P/photos/SAVED'
    folder=tmp_path/'photo_cache';folder.mkdir()
    (folder/(hashlib.sha256(ref.encode()).hexdigest()+'.jpg')).write_bytes(b'\xff\xd8saved')
    with patch.object(ph,'cache_dir',return_value=folder),patch('httpx.AsyncClient.get',new=AsyncMock(return_value=_img())) as get:
        r=client.get('/api/photos/'+ref)
    assert r.status_code==200 and r.content==b'\xff\xd8saved' and not get.called
