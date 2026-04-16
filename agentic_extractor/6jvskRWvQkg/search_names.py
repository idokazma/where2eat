import json
with open('/Users/ido.kazma/Desktop/Projects/private/where2eat/agentic_extractor/6jvskRWvQkg/transcript.json') as f:
    data = json.load(f)
segments = data.get('segments', [])
names = ['פוסה', 'משיה', 'מיז', 'אלקבר', 'הלנסן', 'צפריר', 'ספריר', 'גורשה', 'מושיק', 'פרינו', 'גפן', 'סטודיו', 'ריבנו', 'בוץ', 'אמיה', 'סניור', 'הסתקי', 'חשוי', 'פרדס', 'מטרלו', 'פיש', 'צקולי', 'סבזי', 'גורמי', 'שוק', 'צוטה', 'צ\'וטה', 'מחנה', 'ארנסטו']
for name in names:
    for i, seg in enumerate(segments):
        if name in seg.get('text', ''):
            start = seg['start']
            mins = int(start // 60)
            secs = int(start % 60)
            print(f'{name}: {mins}:{secs:02d} [{i}]: {seg["text"][:90]}')
