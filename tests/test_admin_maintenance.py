"""Transactional maintenance invariants, with no network access."""
import json
import pytest
from database import Database
from admin_maintenance import Maintenance, Conflict

@pytest.fixture
def setup(tmp_path):
    db=Database(str(tmp_path/'test.db'))
    with db.get_connection() as c:
        for e in ['e1','e2']:
            c.execute('INSERT INTO episodes(id,video_id,video_url) VALUES(?,?,?)',(e,e,'https://youtube.com/watch?v='+e))
        for r in ['keep','drop']:
            c.execute('INSERT INTO restaurants(id,episode_id,name_hebrew,city,google_place_id) VALUES(?,?,?,?,?)',(r,'e1',r,'TA','same-place' if r=='keep' else None))
        for mid,e,r,t in [('m1','e1','keep',10),('m2','e1','drop',20),('m3','e2','keep',30)]:
            c.execute('INSERT INTO episode_mentions(id,episode_id,restaurant_id,video_id,name_hebrew,verdict,timestamp_seconds,host_quotes) VALUES(?,?,?,?,?,?,?,?)',(mid,e,r,e,r,'add_to_page',t,'["quote"]'))
    return db,Maintenance(db)

def test_merge_preview_and_undo(setup):
    db,s=setup;p=s.preview_merge('keep','drop');assert p['impact']['mentions_moved']==1
    out=s.merge('keep','drop',p['revision'],'admin')
    with db.get_connection() as c:
        assert c.execute('SELECT restaurant_id FROM episode_mentions WHERE id="m2"').fetchone()[0]=='keep'
    s.undo(out['operation_id'],'admin')
    with db.get_connection() as c:
        assert c.execute('SELECT restaurant_id FROM episode_mentions WHERE id="m2"').fetchone()[0]=='drop'
        assert c.execute('SELECT is_hidden FROM restaurants WHERE id="drop"').fetchone()[0]==0

def test_stale_preview_cannot_merge(setup):
    db,s=setup;p=s.preview_merge('keep','drop')
    with db.get_connection() as c:c.execute('UPDATE restaurants SET city="changed" WHERE id="drop"')
    with pytest.raises(Conflict):s.merge('keep','drop',p['revision'],'admin')

def test_undo_refuses_later_edits(setup):
    db,s=setup;p=s.preview_merge('keep','drop');o=s.merge('keep','drop',p['revision'],'admin')
    with db.get_connection() as c:c.execute('UPDATE episode_mentions SET host_comments="later" WHERE id="m2"')
    with pytest.raises(Conflict):s.undo(o['operation_id'],'admin')

def test_delete_keeps_shared_restaurant_and_reparents(setup):
    db,s=setup;p=s.preview_delete('e1');o=s.delete_episode('e1',p['revision'],'admin')
    with db.get_connection() as c:
        assert c.execute('SELECT episode_id FROM restaurants WHERE id="keep"').fetchone()[0]=='e2'
        assert c.execute('SELECT mention_timestamp FROM restaurants WHERE id="keep"').fetchone()[0]==30
        assert c.execute('SELECT COUNT(*) FROM restaurants WHERE id="drop"').fetchone()[0]==0
        assert c.execute('SELECT COUNT(*) FROM episode_mentions').fetchone()[0]==1
        assert c.execute('SELECT COUNT(*) FROM maintenance_operations WHERE id=?',(o['operation_id'],)).fetchone()[0]==1

def test_mention_repair_preserves_source_quote_timestamp(setup):
    db,s=setup;p=s.preview_repair('m2',{'name_hebrew':'canonical','restaurant_id':'keep'})
    s.repair('m2',{'name_hebrew':'canonical','restaurant_id':'keep'},p['revision'],'admin')
    with db.get_connection() as c:
        r=dict(c.execute('SELECT * FROM episode_mentions WHERE id="m2"').fetchone())
        assert r['original_name_hebrew']=='drop' and r['host_quotes']=='["quote"]' and r['timestamp_seconds']==20
        assert r['name_hebrew']=='canonical'

def test_merge_flags_conflicting_identity(setup):
    db,s=setup
    with db.get_connection() as c:c.execute('UPDATE restaurants SET google_place_id="different" WHERE id="drop"')
    p=s.preview_merge('keep','drop');assert p['warnings']
    with pytest.raises(Conflict):s.merge('keep','drop',p['revision'],'admin')

def test_delete_undo_restores_exact_rows(setup):
    db,s=setup
    with db.get_connection() as c:
        c.execute("INSERT INTO video_queue(id,video_id,video_url,status,episode_id) VALUES('q','e1','url','completed','e1')")
    p=s.preview_delete('e1');o=s.delete_episode('e1',p['revision'],'admin');s.undo(o['operation_id'],'admin')
    with db.get_connection() as c:
        assert c.execute('SELECT COUNT(*) FROM episodes').fetchone()[0]==2
        assert c.execute('SELECT COUNT(*) FROM episode_mentions').fetchone()[0]==3
        assert c.execute('SELECT episode_id FROM video_queue WHERE id="q"').fetchone()[0]=='e1'

def test_processing_episode_cannot_delete(setup):
    db,s=setup
    with db.get_connection() as c:c.execute("INSERT INTO video_queue(id,video_id,video_url,status,episode_id) VALUES('q','e1','url','processing','e1')")
    with pytest.raises(Conflict):s.preview_delete('e1')

def test_canonical_name_does_not_erase_source(setup):
    db,s=setup
    with db.get_connection() as c:c.execute('UPDATE restaurants SET name_hebrew="canonical" WHERE id="drop"')
    mentions=db.get_episode_mentions('e1');m=next(m for m in mentions if m['id']=='m2')
    assert m['name_hebrew']=='canonical' and m['original_name_hebrew']=='drop'
    assert m['timestamp_seconds']==20 and m['host_quotes']==['quote']

def test_delete_preserves_place_id_only_shared_reference(setup):
    db,s=setup
    with db.get_connection() as c:
        c.execute('UPDATE episode_mentions SET restaurant_id=NULL,google_place_id="same-place" WHERE id="m3"')
    p=s.preview_delete('e1');assert 'keep' in p['impact']['restaurants_preserved']
    s.delete_episode('e1',p['revision'],'a')
    with db.get_connection() as c:assert c.execute('SELECT episode_id FROM restaurants WHERE id="keep"').fetchone()[0]=='e2'

def test_merge_blocks_unrepresented_timestamp_even_with_other_mentions(setup):
    db,s=setup
    with db.get_connection() as c:c.execute('UPDATE restaurants SET mention_timestamp=99,video_id="e1" WHERE id="drop"')
    p=s.preview_merge('keep','drop');assert p['warnings']
    with pytest.raises(Conflict):s.merge('keep','drop',p['revision'],'a')

def test_new_link_blocks_merge_undo(setup):
    db,s=setup;p=s.preview_merge('keep','drop');o=s.merge('keep','drop',p['revision'],'a')
    with db.get_connection() as c:c.execute('INSERT INTO episode_mentions(id,episode_id,video_id,name_hebrew,verdict,restaurant_id) VALUES("new","e2","e2","x","add_to_page","drop")')
    with pytest.raises(Conflict):s.undo(o['operation_id'],'a')

def test_new_queue_blocks_delete_undo(setup):
    db,s=setup;p=s.preview_delete('e1');o=s.delete_episode('e1',p['revision'],'a')
    with db.get_connection() as c:c.execute('INSERT INTO video_queue(id,video_id,video_url,status) VALUES("new","e1","url","queued")')
    with pytest.raises(Conflict):s.undo(o['operation_id'],'a')

def test_snapshot_failure_rolls_back_mutation(setup,monkeypatch):
    db,s=setup;p=s.preview_merge('keep','drop')
    def fail(*args):raise RuntimeError('disk full')
    monkeypatch.setattr(s,'_record',fail)
    with pytest.raises(RuntimeError):s.merge('keep','drop',p['revision'],'a')
    with db.get_connection() as c:assert c.execute('SELECT restaurant_id FROM episode_mentions WHERE id="m2"').fetchone()[0]=='drop'

def test_merge_links_place_id_only_mentions_before_hiding(setup):
    db,s=setup
    with db.get_connection() as c:
        c.execute('UPDATE restaurants SET google_place_id=NULL WHERE id="keep"')
        c.execute('UPDATE restaurants SET google_place_id="drop-place" WHERE id="drop"')
        c.execute('UPDATE episode_mentions SET restaurant_id=NULL,google_place_id="drop-place" WHERE id="m3"')
    p=s.preview_merge('keep','drop');o=s.merge('keep','drop',p['revision'],'a')
    with db.get_connection() as c:assert c.execute('SELECT restaurant_id FROM episode_mentions WHERE id="m3"').fetchone()[0]=='keep'
    s.undo(o['operation_id'],'a')
    with db.get_connection() as c:assert c.execute('SELECT restaurant_id FROM episode_mentions WHERE id="m3"').fetchone()[0] is None

def test_repair_target_change_invalidates_preview(setup):
    db,s=setup;p=s.preview_repair('m2',{'restaurant_id':'keep'})
    with db.get_connection() as c:c.execute('UPDATE restaurants SET name_hebrew="changed" WHERE id="keep"')
    with pytest.raises(Conflict):s.repair('m2',{'restaurant_id':'keep'},p['revision'],'a')

def test_legacy_active_job_blocks_delete(setup):
    db,s=setup
    with db.get_connection() as c:c.execute('INSERT INTO jobs(id,job_type,status,current_video_id) VALUES("j","video","running","e1")')
    with pytest.raises(Conflict):s.preview_delete('e1')

def test_deleted_place_id_new_reference_blocks_undo(setup):
    db,s=setup
    with db.get_connection() as c:c.execute('UPDATE restaurants SET google_place_id="gone-place" WHERE id="drop"')
    p=s.preview_delete('e1');o=s.delete_episode('e1',p['revision'],'a')
    with db.get_connection() as c:c.execute('INSERT INTO episode_mentions(id,episode_id,video_id,name_hebrew,verdict,google_place_id) VALUES("new","e2","e2","x","add_to_page","gone-place")')
    with pytest.raises(Conflict):s.undo(o['operation_id'],'a')


def test_timestamp_correction_preserves_history_and_undo(setup):
    db,s=setup
    with db.get_connection() as c:
        before=dict(c.execute('SELECT * FROM episode_mentions WHERE id="m2"').fetchone())
    changes={'timestamp_seconds':2958}
    p=s.preview_repair('m2',changes)
    out=s.repair('m2',changes,p['revision'],'admin')
    with db.get_connection() as c:
        after=dict(c.execute('SELECT * FROM episode_mentions WHERE id="m2"').fetchone())
        assert after == {**before,'timestamp_seconds':2958,'timestamp_display':'49:18'}
        op=c.execute('SELECT before_json FROM maintenance_operations WHERE id=?',(out['operation_id'],)).fetchone()
        assert json.loads(op[0])['episode_mentions'][0] == before
    s.undo(out['operation_id'],'admin')
    with db.get_connection() as c:
        assert dict(c.execute('SELECT * FROM episode_mentions WHERE id="m2"').fetchone()) == before

def test_timestamp_correction_recomputes_display(setup):
    db,s=setup
    for ts,display in [(0,'0:00'),(5,'0:05'),(140,'2:20'),(2958,'49:18'),(604800,'10080:00')]:
        p=s.preview_repair('m2',{'timestamp_seconds':ts})
        s.repair('m2',{'timestamp_seconds':ts},p['revision'],'admin')
        with db.get_connection() as c:
            row=c.execute('SELECT timestamp_seconds,timestamp_display FROM episode_mentions WHERE id="m2"').fetchone()
            assert (row['timestamp_seconds'],row['timestamp_display'])==(ts,display)

@pytest.mark.parametrize('value',[None,True,False,'2958',2958.5,-1,604801])
def test_timestamp_correction_rejects_invalid_values(setup,value):
    _,s=setup
    with pytest.raises(ValueError):s.preview_repair('m2',{'timestamp_seconds':value})

def test_timestamp_correction_requires_standalone_change(setup):
    _,s=setup
    with pytest.raises(ValueError):s.preview_repair('m2',{'timestamp_seconds':2958,'name_hebrew':'other'})

def test_timestamp_correction_rejects_stale_preview(setup):
    db,s=setup;changes={'timestamp_seconds':2958};p=s.preview_repair('m2',changes)
    with db.get_connection() as c:c.execute('UPDATE episode_mentions SET timestamp_seconds=21 WHERE id="m2"')
    with pytest.raises(Conflict):s.repair('m2',changes,p['revision'],'admin')

def test_timestamp_correction_rolls_back_if_snapshot_fails(setup,monkeypatch):
    db,s=setup;changes={'timestamp_seconds':2958};p=s.preview_repair('m2',changes)
    def fail(*args):raise RuntimeError('disk full')
    monkeypatch.setattr(s,'_record',fail)
    with pytest.raises(RuntimeError):s.repair('m2',changes,p['revision'],'admin')
    with db.get_connection() as c:assert c.execute('SELECT timestamp_seconds FROM episode_mentions WHERE id="m2"').fetchone()[0]==20
