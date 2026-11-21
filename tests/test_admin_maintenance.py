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


def review(text='A complete verified sentence.'):
    return {'text':text,'source_url':'https://traffic.megaphone.fm/example.mp3',
            'start_seconds':300,'end_seconds':330}


def test_verified_quote_preserves_raw_and_is_displayed(setup):
    db,s=setup
    changes={'verified_quote':review(),'host_comments':'Editorial context','speaker':'verified speaker'}
    p=s.preview_repair('m2',changes)
    out=s.repair('m2',changes,p['revision'],'reviewer')
    with db.get_connection() as c:
        row=dict(c.execute('SELECT * FROM episode_mentions WHERE id="m2"').fetchone())
        assert row['host_quotes']=='["quote"]'
        saved=json.loads(row['verified_quote'])
        assert saved['reviewed_by']=='reviewer' and saved['reviewed_at']
        assert row['original_name_hebrew'] is None
    m=next(m for m in db.get_episode_mentions('e1') if m['id']=='m2')
    assert m['source_host_quotes']==['quote']
    assert m['host_quotes']==['A complete verified sentence.']
    assert m['verified_quote']['source_url']==review()['source_url']
    assert db.get_restaurant_mentions('drop')[0]['host_quotes']==m['host_quotes']
    s.undo(out['operation_id'],'admin')
    m=next(m for m in db.get_episode_mentions('e1') if m['id']=='m2')
    assert m['host_quotes']==['quote'] and m['verified_quote'] is None


@pytest.mark.parametrize('changes',[
    {'host_quotes':['fabricated']},
    {'verified_quote':{}},
    {'verified_quote':{**review(),'text':' '}},
    {'verified_quote':{**review(),'text':'x'*1001}},
    {'verified_quote':{**review(),'source_url':'http://example.com/audio'}},
    {'verified_quote':{**review(),'source_url':'https://user:secret@example.com/audio'}},
    {'verified_quote':{**review(),'source_url':123}},
    {'verified_quote':{**review(),'start_seconds':True}},
    {'verified_quote':{**review(),'end_seconds':300}},
    {'verified_quote':{**review(),'end_seconds':604801}},
    {'verified_quote':{**review(),'reviewed_by':'spoofed'}},
])
def test_verified_quote_rejects_invalid_evidence(setup,changes):
    _,s=setup
    with pytest.raises(ValueError):s.preview_repair('m2',changes)


def test_quote_change_checks_revision_and_undo_conflict(setup):
    db,s=setup;changes={'verified_quote':review()};p=s.preview_repair('m2',changes)
    with db.get_connection() as c:c.execute('UPDATE episode_mentions SET speaker="concurrent" WHERE id="m2"')
    with pytest.raises(Conflict):s.repair('m2',changes,p['revision'],'a')
    p=s.preview_repair('m2',changes);out=s.repair('m2',changes,p['revision'],'a')
    with db.get_connection() as c:c.execute('UPDATE episode_mentions SET host_comments="later" WHERE id="m2"')
    with pytest.raises(Conflict):s.undo(out['operation_id'],'a')


def test_verified_quote_rolls_back_on_audit_failure(setup,monkeypatch):
    db,s=setup;changes={'verified_quote':review()};p=s.preview_repair('m2',changes)
    def fail(*args):raise RuntimeError('disk full')
    monkeypatch.setattr(s,'_record',fail)
    with pytest.raises(RuntimeError):s.repair('m2',changes,p['revision'],'a')
    with db.get_connection() as c:
        row=c.execute('SELECT verified_quote,host_quotes FROM episode_mentions WHERE id="m2"').fetchone()
        assert row['verified_quote'] is None and row['host_quotes']=='["quote"]'


def test_verified_quote_can_be_reset_without_erasing_source(setup):
    db,s=setup;changes={'verified_quote':review()};p=s.preview_repair('m2',changes)
    s.repair('m2',changes,p['revision'],'a')
    changes={'verified_quote':None};p=s.preview_repair('m2',changes)
    s.repair('m2',changes,p['revision'],'a')
    assert db.get_restaurant_mentions('drop')[0]['host_quotes']==['quote']


def test_quote_migration_is_repeatable(setup):
    db,_=setup
    Database(db.db_path)
    with db.get_connection() as c:
        assert sum(r['name']=='verified_quote' for r in c.execute('PRAGMA table_info(episode_mentions)'))==1


def legacy_snapshot(db,oid):
    with db.get_connection() as c:
        row=c.execute('SELECT before_json,after_json FROM maintenance_operations WHERE id=?',(oid,)).fetchone()
        values=[]
        for value in row:
            state=json.loads(value)
            for m in state.get('episode_mentions',[]):m.pop('verified_quote',None)
            values.append(json.dumps(state))
        c.execute('UPDATE maintenance_operations SET before_json=?,after_json=? WHERE id=?',(*values,oid))


def test_quote_migration_keeps_old_snapshot_undo(setup):
    db,s=setup;changes={'host_opinion':'positive'};p=s.preview_repair('m2',changes)
    out=s.repair('m2',changes,p['revision'],'a');legacy_snapshot(db,out['operation_id'])
    s.undo(out['operation_id'],'a')
    with db.get_connection() as c:assert c.execute('SELECT host_opinion FROM episode_mentions WHERE id="m2"').fetchone()[0] is None


def test_old_snapshot_undo_refuses_later_verified_quote(setup):
    db,s=setup;changes={'host_opinion':'positive'};p=s.preview_repair('m2',changes)
    out=s.repair('m2',changes,p['revision'],'a');legacy_snapshot(db,out['operation_id'])
    with db.get_connection() as c:c.execute('UPDATE episode_mentions SET verified_quote=? WHERE id="m2"',(json.dumps(review()),))
    with pytest.raises(Conflict):s.undo(out['operation_id'],'a')

def test_source_label_changes_only_label_and_undoes(setup):
    db,s=setup
    with db.get_connection() as c:
        c.execute('UPDATE episodes SET channel_name="Publisher" WHERE id="e1"')
        c.execute('UPDATE restaurants SET channel_name="Publisher" WHERE episode_id="e1"')
        before=dict(c.execute('SELECT * FROM episodes WHERE id="e1"').fetchone())
    p=s.preview_source_label('e1','Show');assert p['impact']['restaurants_relabelled']==2
    o=s.set_source_label('e1','Show',p['revision'],'admin')
    with db.get_connection() as c:
        after=dict(c.execute('SELECT * FROM episodes WHERE id="e1"').fetchone())
        assert after['channel_name']=='Show'
        assert {k:v for k,v in after.items() if k!='channel_name'}=={k:v for k,v in before.items() if k!='channel_name'}
        assert c.execute('SELECT COUNT(*) FROM restaurants WHERE channel_name="Show"').fetchone()[0]==2
        assert c.execute('SELECT channel_name FROM episodes WHERE id="e2"').fetchone()[0] is None
        assert c.execute('SELECT COUNT(*) FROM episode_mentions').fetchone()[0]==3
    s.undo(o['operation_id'],'admin')
    with db.get_connection() as c:
        assert c.execute('SELECT channel_name FROM episodes WHERE id="e1"').fetchone()[0]=='Publisher'
        assert c.execute('SELECT COUNT(*) FROM restaurants WHERE channel_name="Publisher"').fetchone()[0]==2

def test_source_label_validates_and_rejects_stale(setup):
    db,s=setup
    with pytest.raises(ValueError):s.preview_source_label('e1','  ')
    with pytest.raises(LookupError):s.preview_source_label('nope','Show')
    p=s.preview_source_label('e1','Show')
    with db.get_connection() as c:c.execute('UPDATE episodes SET channel_name="other" WHERE id="e1"')
    with pytest.raises(Conflict):s.set_source_label('e1','Show',p['revision'],'admin')


def test_set_source_label_relabels_restaurants_linked_only_by_video(tmp_path):
    from database import Database
    from admin_maintenance import Maintenance
    db = Database(str(tmp_path / 'label.db'))
    with db.get_connection() as c:
        c.execute("INSERT INTO episodes (id, video_id, video_url, channel_name) VALUES ('e1','vid1','u','בית הפודיום')")
        c.execute("INSERT INTO restaurants (id, episode_id, name_hebrew, city, video_id, channel_name) VALUES ('r1','e1','א','טירה','vid1','בית הפודיום')")
        c.execute("INSERT INTO restaurants (id, episode_id, name_hebrew, city, video_id, channel_name) VALUES ('r2',NULL,'ב','טירה','vid1','בית הפודיום')")
        c.execute("INSERT INTO restaurants (id, episode_id, name_hebrew, city, video_id, channel_name) VALUES ('r3',NULL,'ג','טירה','other','בית הפודיום')")
    m = Maintenance(db)
    p = m.preview_source_label('vid1', 'מדברים מהבטן - הפודיום')
    assert p['impact']['restaurants_relabelled'] == 2
    out = m.set_source_label('vid1', 'מדברים מהבטן - הפודיום', p['revision'], 'admin')
    with db.get_connection() as c:
        labels = dict(c.execute('SELECT id, channel_name FROM restaurants').fetchall())
    assert labels == {'r1': 'מדברים מהבטן - הפודיום', 'r2': 'מדברים מהבטן - הפודיום', 'r3': 'בית הפודיום'}
    m.undo(out['operation_id'], 'admin')
    with db.get_connection() as c:
        assert {r[0] for r in c.execute("SELECT id FROM restaurants WHERE channel_name='בית הפודיום'")} == {'r1', 'r2', 'r3'}
