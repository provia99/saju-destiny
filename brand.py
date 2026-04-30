import json, os, datetime
from config import BRANDS_DIR

def create_brand_profile(master_data: dict) -> str:
    master_id = master_data['master_id']
    brand_dir = os.path.join(BRANDS_DIR, master_id)
    os.makedirs(brand_dir, exist_ok=True)
    profile = {
        'master_id':    master_id,
        '선생님이름':   master_data.get('선생님이름',''),
        '연구소명':     master_data.get('연구소명',''),
        '서명문구':     master_data.get('서명문구',''),
        '마무리인사':   master_data.get('마무리인사',''),
        '호칭조사':     master_data.get('호칭조사','이'),
        '연락처':       master_data.get('연락처',''),
        '이메일':       master_data.get('이메일',''),
        '홈페이지':     master_data.get('홈페이지',''),
        '카카오채널':   master_data.get('카카오채널',''),
        '브랜드색상':   master_data.get('브랜드색상','#1A3A6A'),
        '금색':         master_data.get('금색','#C8B860'),
        '배경색':       '#FAFAF5',
        '발행연도':     str(datetime.date.today().year),
        'api_key':      master_data.get('api_key',''),
    }
    path = os.path.join(brand_dir, 'profile.json')
    json.dump(profile, open(path,'w',encoding='utf-8'), ensure_ascii=False, indent=2)
    return path

def update_brand_profile(master_id: str, updates: dict):
    path = os.path.join(BRANDS_DIR, master_id, 'profile.json')
    if not os.path.exists(path):
        create_brand_profile({'master_id': master_id, **updates})
        return
    profile = json.load(open(path, encoding='utf-8'))
    for k,v in updates.items():
        if k in profile: profile[k] = v
    json.dump(profile, open(path,'w',encoding='utf-8'), ensure_ascii=False, indent=2)

def load_brand_profile(master_id: str) -> dict:
    path = os.path.join(BRANDS_DIR, master_id, 'profile.json')
    if not os.path.exists(path): return {}
    return json.load(open(path, encoding='utf-8'))
