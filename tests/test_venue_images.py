import io
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'api'))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
import pytest
from routers.venue_images import router

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_DIR', str(tmp_path))
    monkeypatch.setenv('API_SECRET_KEY', 'x' * 40)
    monkeypatch.delenv('RAILWAY_ENVIRONMENT_ID', raising=False)
    app = FastAPI(); app.include_router(router)
    return TestClient(app)

def picture():
    b=io.BytesIO();Image.new('RGB',(80,60),'red').save(b,'JPEG');return b.getvalue()

def upload(client, raw=None, auth=True, **data):
    return client.post('/api/admin/venue-images', headers={'Authorization':'Bearer '+'x'*40} if auth else {},
       content=picture() if raw is None else raw,
       params={'restaurant_id':'3b7c04ad-cdcd-4bc2-bd3a-75ef68aa3a92','source_url':'https://www.instagram.com/afrit.tlv/p/DcTkqgzje5e/','credit':'Afrit',**data})

def test_unauthenticated(client):
    assert upload(client, auth=False).status_code == 401

def test_wrong_token(client):
    r=client.post('/api/admin/venue-images',headers={'Authorization':'Bearer nope'})
    assert r.status_code==401

def test_missing_secret_fails_closed(client,monkeypatch):
    monkeypatch.delenv('API_SECRET_KEY'); assert upload(client).status_code==503

def test_roundtrip_provenance_private_and_restart(client,tmp_path):
    r=upload(client);assert r.status_code==200,r.text
    asset=r.json()['asset_path'];g=client.get(asset)
    assert g.status_code==200 and g.headers['content-type']=='image/jpeg'
    assert 'immutable' in g.headers['cache-control']
    assert g.headers['x-content-type-options']=='nosniff'
    assert Image.open(io.BytesIO(g.content)).size==(80,60)
    assert len(list((tmp_path/'venue_images'/'provenance').glob('*.json')))==1
    app=FastAPI();app.include_router(router)
    assert TestClient(app).get(asset).content==g.content
    assert client.get('/api/venue-images/provenance').status_code==404
    assert upload(client).json()['asset_path']==asset

@pytest.mark.parametrize('raw',[b'<svg><script>alert(1)</script></svg>',b'',b'GIF89a'])
def test_invalid_content(client,raw):
    assert upload(client,raw).status_code==422

def test_oversized(client):
    assert upload(client,b'x'*(5*1024*1024+1)).status_code==413

def test_bad_source_and_id(client):
    assert upload(client,source_url='file:///etc/passwd').status_code==422
    assert upload(client,restaurant_id='../../etc/passwd').status_code==422

def test_path_not_file_server(client):
    assert client.get('/api/venue-images/admin_users.json').status_code==404
    assert client.get('/api/venue-images/'+'0'*64+'.jpg').status_code==404

def test_railway_requires_volume(client,monkeypatch):
    monkeypatch.setenv('RAILWAY_ENVIRONMENT_ID','production')
    monkeypatch.delenv('RAILWAY_VOLUME_MOUNT_PATH',raising=False)
    assert upload(client).status_code==503

def test_railway_volume_path(client,tmp_path,monkeypatch):
    monkeypatch.setenv('RAILWAY_ENVIRONMENT_ID','production')
    monkeypatch.setenv('RAILWAY_VOLUME_MOUNT_PATH',str(tmp_path))
    assert upload(client).status_code==200
    monkeypatch.setenv('DATABASE_DIR',str(tmp_path.parent/'elsewhere'))
    assert upload(client).status_code==503

def test_bearer_not_cookie(client):
    client.cookies.set('where2eat_admin_token','forged-token')
    assert upload(client,auth=False).status_code==401

def test_pixel_limit(client):
    b=io.BytesIO();Image.new('RGB',(4001,4000),'red').save(b,'PNG')
    assert upload(client,b.getvalue()).status_code==422

def test_public_route_rejects_symlink(client,tmp_path):
    root=tmp_path/'venue_images';root.mkdir();target=tmp_path/'private';target.write_text('private')
    (root/('a'*64+'.jpg')).symlink_to(target)
    assert client.get('/api/venue-images/'+'a'*64+'.jpg').status_code==404

def test_strip_metadata(client):
    b=io.BytesIO();im=Image.new('RGB',(80,60),'red');exif=Image.Exif();exif[270]='private description'
    im.save(b,'JPEG',exif=exif)
    r=upload(client,b.getvalue());assert r.status_code==200
    assert not Image.open(io.BytesIO(client.get(r.json()['asset_path']).content)).getexif()

def test_origin_gate_public_get_and_authenticated_upload_only(client):
    # Use the actual class from main.py without invoking production startup/schedulers.
    import ast, os
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request
    tree=ast.parse((Path(__file__).resolve().parents[1]/'api/main.py').read_text())
    node=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='OriginGateMiddleware')
    ns={'BaseHTTPMiddleware':BaseHTTPMiddleware,'Request':Request,'os':os,'allowed_origins':['https://www.where2eat.rest']}
    exec(compile(ast.Module(body=[node],type_ignores=[]),'main.py','exec'),ns)
    client.app.add_middleware(ns['OriginGateMiddleware'])
    assert upload(client,auth=False).status_code==401
    r=upload(client);assert r.status_code==200
    assert client.get(r.json()['asset_path']).status_code==200
    assert client.post('/api/venue-images/not-allowed').status_code==403
    assert client.get('/api/admin/venue-images').status_code==403
    assert client.post('/api/admin/venue-images/extra').status_code==403
