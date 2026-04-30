import sys
import json
import logging
import subprocess
import asyncio
import os
from pathlib import Path
from datetime import datetime
from slot_path import make_slot_dir

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def _parse_exact_time(s: str) -> dict:
    """birth_time_accuracy 컬럼에 저장된 'HH:MM' 또는 'HH:MM:SS'를 파싱해
    {정확시간:int, 정확분:int}로 반환. 빈 문자열·잘못된 형식이면 빈 dict
    (engine은 생시 한글로 폴백)."""
    s = (s or "").strip()
    if not s:
        return {}
    parts = s.split(":")
    if len(parts) < 2:
        return {}
    try:
        hh = int(parts[0])
        mm = int(parts[1])
    except (ValueError, TypeError):
        return {}
    if not (0 <= hh <= 23 and 0 <= mm <= 59):
        return {}
    return {"정확시간": hh, "정확분": mm}


class SajuWriter:
    def __init__(self, engine_dir=None, output_dir=None):
        self.engine_dir = Path(engine_dir) if engine_dir else Path("engine")
        self.queue_dir = self.engine_dir / "queue"
        self.output_dir = Path(output_dir) if output_dir else Path("output")

        self.queue_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def write(self, member: dict, master_id: str, book_id: int, book_year: int = None,
              product_type: str = "saju_full",
              partner_data: dict = None,
              relationship_info: dict = None) -> dict:
        book_year = book_year or datetime.now().year
        member_key = f"{master_id}_{book_id}"

        # ── 상품별 슬롯 서브디렉토리 결정 ──
        # saju_full/saju_summary/yearly_fortune → "saju"
        # compatibility → "compatibility"
        slot_subdir = "compatibility" if product_type == "compatibility" else "saju"

        # ── 슬롯 폴더 경로 계산 (새 규칙: m{member_id:05d}_{name}) ────
        # 폴더는 회원 단위로 공유. member.id가 PK이므로 항상 유일.
        # 이름이 변경되어도 prefix가 같으면 같은 회원으로 식별됨.
        _member_id_for_folder = int(member.get("id", 0)) or book_id
        slot_dir = make_slot_dir(
            self.queue_dir, master_id, _member_id_for_folder, member['name'],
            slot_subdir, book_year
        )
        slot_dir.mkdir(parents=True, exist_ok=True)

        # DB에 절대경로 저장 — 라우터가 검색 없이 직접 사용 (Single Source of Truth)
        try:
            import db as _db
            _db.update_book(book_id, {"slot_dir": str(slot_dir.resolve())})
        except Exception as _e:
            logging.warning(f"slot_dir DB 기록 실패: {_e}")

        # profile.json 》 개인 불변 정보 (상위 개인 폴더에 저장)
        person_dir = slot_dir.parent.parent  # {subdir}/2026 → 개인폴더
        self._save_profile(person_dir, member)

        try:
            # 1) master JSON 생성 (궁합이면 partner + 관계정보 주입)
            master_data = self._build_master_json(
                member, master_id, book_year, member_key, product_type,
                partner_data=partner_data, relationship_info=relationship_info
            )
            # 1-a) 음력 날짜 유효성 사전 검사 (엔진 호출 전)
            self._validate_lunar_date(master_data)
            # 2) 슬롯 폴더에 저장
            master_json_path = self._save_master_json(slot_dir, master_data)
            # 3) 엔진 실행
            self._run_engine(master_json_path)
            # 4) 결과물 확인 》 슬롯 폴더의 result.txt
            result_path = slot_dir / "result.txt"
            if not result_path.exists():
                raise Exception(f"결과 파일을 찾을 수 없습니다 (슬롯: {slot_dir})")
            # 5) 글자수 계산
            with open(result_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                chars = len(content)
            # 6) 마스터 TABLE 레이아웃 적용 (저장된 템플릿이 있으면 챕터 앞에 자동 삽입)
            self._apply_table_layout(result_path, master_id)

            # 7) 에디터 자동 호출
            self._launch_editor(result_path)

            return {
                "success": True,
                "output_path": str(result_path).replace("\\", "/"),
                "chars": chars,
                "error": None,
            }
        except Exception as e:
            return {
                "success": False,
                "output_path": None,
                "chars": 0,
                "error": str(e),
            }

    def _launch_editor(self, file_path: Path):
        """생성된 파일을 편집기(editor_launcher.py)로 엽니다."""
        try:
            editor_script = Path(__file__).parent / "editor_launcher.py"
            if editor_script.exists():
                logging.info(f"Launching editor for: {file_path}")
                subprocess.Popen([sys.executable, str(editor_script), str(file_path)])
            else:
                logging.warning(f"Editor script not found at {editor_script}")
        except Exception as e:
            logging.error(f"Failed to launch editor: {e}")

    def _validate_lunar_date(self, master_data: dict):
        """음력 입력인 경우 날짜 범위 기본 검사 (엔진 호출 전 빠른 오류 반환)"""
        if not master_data.get("음력입력"):
            return  # 양력이면 검사 불필요

        year  = master_data.get("생년")
        month = master_data.get("생월")
        day   = master_data.get("생일")
        leap  = master_data.get("윤달", False)
        name  = master_data.get("이름", "")

        # 월 범위: 1~12
        if not (1 <= month <= 12):
            raise ValueError(
                f"[{name}] 음력 월 범위 오류: {month}월 (1~12월 사이여야 합니다)"
            )
        # 일 범위: 1~30 (음력은 최대 30일)
        if not (1 <= day <= 30):
            raise ValueError(
                f"[{name}] 음력 일 범위 오류: {day}일 (1~30일 사이여야 합니다)"
            )
        # 윤달이면 해당 연·월에 실제로 윤달이 있는지 Node.js로 확인
        if leap:
            self._validate_leap_month(year, month, name)

    def _validate_leap_month(self, year: int, month: int, name: str):
        """윤달 유효성 검사 》 해당 년·월이 실제 윤달인지 Node.js saju_calc로 확인"""
        import os
        node_dir = r"C:\Program Files\nodejs"
        env = os.environ.copy()
        if os.path.exists(node_dir):
            env["PATH"] = node_dir + os.pathsep + env.get("PATH", "")
        node_cmd = (
            os.path.join(node_dir, "node.exe")
            if os.path.exists(os.path.join(node_dir, "node.exe"))
            else "node"
        )
        # saju_calc의 _음력to양력 함수를 통해 윤달 유효성 직접 검사
        js_code = (
            f"const {{전체사주계산}}=require('./saju_calc');"
            f"try{{전체사주계산({{이름:'test',음력입력:true,윤달:true,"
            f"년:{year},월:{month},일:1,시간:12,성별:'남'}});"
            f"process.stdout.write('ok');}}catch(e){{process.stdout.write('err:'+e.message);}}"
        )
        import subprocess
        result = subprocess.run(
            [node_cmd, "-e", js_code],
            cwd=str(self.engine_dir.resolve()),
            capture_output=True, text=True, timeout=15, encoding="utf-8", env=env
        )
        out = (result.stdout or "").strip()
        if out.startswith("err:"):
            raise ValueError(f"[{name}] {out[4:]}")

    def _build_master_json(self, member: dict, master_id: str, book_year: int, member_key: str,
                           product_type: str = "saju_full",
                           partner_data: dict = None,
                           relationship_info: dict = None) -> dict:
        import db
        master = db.get_master(master_id) or {}

        act_map = {"무직": "은퇴", "백수": "은퇴", "전업주부": "주부", "자영업": "사업가"}
        act_norm = act_map.get(member.get("activity_type", "직장인"), member.get("activity_type", "직장인"))

        par_map = {"있음": "양친", "두분다": "양친", "두분다안계심": "없음"}
        par_norm = par_map.get(member.get("parent_status", "양친"), member.get("parent_status", "양친"))

        data = {
            "이름": member["name"],
            "전화번호": str(member.get("phone", "") or ""),
            "id": member_key,
            "음력입력": bool(member.get("lunar_yn", 0)),
            "윤달": bool(member.get("leap_month_yn", 0)),
            "생년": int(member["birth_year"]),
            "생월": int(member["birth_month"]),
            "생일": int(member["birth_day"]),
            "생시": member["birth_time"],
            "성별": member["gender"],
            # 진태양시 보정 비활성 — 정확시간/분/출생지는 master.json에 넣지 않음
            "활동상태": act_norm,
            "결혼상태": member.get("marital_status", "미혼"),
            "자녀": member.get("has_children", "없음"),
            "고민분야": member.get("concern_area", "종합"),
            "형제유무": member.get("has_siblings", "있음"),
            "부모상황": par_norm,
            "건강관심": member.get("health_concern", "없음"),
            "master_id": master_id,
            "선생님이름": master.get("선생님이름", "반야선생"),
            "연구소명": master.get("연구소명", "반야선생 사주명리연구소"),
            "서명문구": master.get("서명문구", ""),
            "마무리인사": master.get("마무리인사", "반야선생이 함께하겠습니다."),
            "연락처": master.get("연락처", ""),
            "홈페이지": master.get("홈페이지", ""),
            "카카오채널": master.get("카카오채널", ""),
            "호칭조사": master.get("호칭조사", "이"),
            "발행연도": str(book_year),
            "브랜드색상": master.get("브랜드색상", "#1A3A6A"),
            "금색": master.get("금색", "#C8B860"),
            "good_periods": member.get("good_periods", ""),
            "bad_periods": member.get("bad_periods", ""),
            "self_q1": member.get("self_q1", ""),
            "self_q2": member.get("self_q2", ""),
            "self_q3": member.get("self_q3", ""),
            "self_q4": member.get("self_q4", ""),
            "self_q5": member.get("self_q5", ""),
            "self_q6": member.get("self_q6", ""),
            "self_q7": member.get("self_q7", ""),
            "product_type": product_type,
        }

        # ── 궁합 전용: partner 객체 + 관계 정보 주입 ──
        if product_type == "compatibility" and partner_data:
            data["partner"] = {
                "이름": partner_data.get("이름", ""),
                "성별": partner_data.get("성별", "남"),
                "생년": partner_data.get("생년"),
                "생월": partner_data.get("생월"),
                "생일": partner_data.get("생일"),
                "생시": partner_data.get("생시", "모름"),
                "음력입력": bool(partner_data.get("음력입력", False)),
                "윤달": bool(partner_data.get("윤달", False)),
            }
            if relationship_info:
                if relationship_info.get("관계단계"):
                    data["관계단계"] = relationship_info["관계단계"]
                if relationship_info.get("관계기간개월") is not None:
                    data["관계기간개월"] = relationship_info["관계기간개월"]
                if relationship_info.get("자녀수") is not None:
                    data["자녀수"] = relationship_info["자녀수"]
                if relationship_info.get("결혼예정일"):
                    data["결혼예정일"] = relationship_info["결혼예정일"]

        logging.info(f"Generated master_json for {member['name']} (master: {master_id}, product: {product_type})")
        return data

    def _save_profile(self, person_dir: Path, member: dict):
        profile_path = person_dir / "profile.json"
        profile = {
            "이름": member.get("name", ""),
            "성별": member.get("gender", ""),
            "생년": member.get("birth_year"),
            "생월": member.get("birth_month"),
            "생일": member.get("birth_day"),
            "생시": member.get("birth_hour", ""),
            "음력입력": member.get("is_lunar", True),
            "윤달": member.get("is_leap_month", False),
            "전화번호": member.get("phone", ""),
        }
        with open(profile_path, "w", encoding="utf-8") as f:
            json.dump(profile, f, ensure_ascii=False, indent=2)

    def _save_master_json(self, slot_dir: Path, master_data: dict) -> Path:
        file_path = slot_dir / "master.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(master_data, f, ensure_ascii=False, indent=2)
        return file_path

    def _run_engine(self, master_json_path: Path):
        node_dir = r"C:\Program Files\nodejs"
        env = os.environ.copy()
        if os.path.exists(node_dir):
            env["PATH"] = node_dir + os.pathsep + env.get("PATH", "")
        node_cmd = os.path.join(node_dir, "node.exe") if os.path.exists(os.path.join(node_dir, "node.exe")) else "node"

        # 상품별 라우터를 통해 실행 (run_product.js → 상품별 run_all.js)
        result = subprocess.run(
            [node_cmd, "run_product.js", str(master_json_path.resolve())],
            cwd=str(self.engine_dir.resolve()), capture_output=True, text=True, timeout=300, encoding="utf-8", env=env
        )
        if result.returncode != 0:
            raise Exception(f"엔진 오류: {result.stderr.strip() or result.stdout[:300]}")

    def _apply_table_layout(self, result_path: Path, master_id: str):
        """output/{master_id}/table_template.json 이 있으면 result.txt 챕터 앞에 TABLE 태그 삽입"""
        import json as _json, re as _re
        layout_path = self.output_dir / master_id / "table_template.json"
        if not layout_path.exists():
            return

        try:
            layout = _json.loads(layout_path.read_text(encoding="utf-8"))
        except Exception as e:
            logging.warning(f"table_template.json 읽기 실패: {e}")
            return

        lines = result_path.read_text(encoding="utf-8", errors="ignore").splitlines(keepends=True)

        # ☯ N장 / ✺ 제N절 / ✦ 소제목 헤더 줄 번호 인덱스
        # 키: "서장" / "서장/제1절" / "서장/제1절/✦0"
        anchor_line = {}
        cur_chapter = ""
        cur_section = ""
        tilda_count = 0   # 현재 절 안의 ✦ 순번
        for i, line in enumerate(lines):
            if "☯" in line:
                m = _re.search(r"☯\s*((?:\d+|서|종)장)", line)
                if m:
                    cur_chapter = m.group(1)
                    cur_section = ""
                    tilda_count = 0
                    anchor_line[cur_chapter] = i
            if "✺" in line:
                m = _re.search(r"✺\s*(제\d+절)", line)
                if m and cur_chapter:
                    cur_section = m.group(1)
                    tilda_count = 0
                    anchor_line[cur_chapter + "/" + cur_section] = i
            # ✦ 소제목: 목차 구간(cur_chapter 미확정)은 건너뜀
            if "✦" in line and cur_chapter:
                sec_key = (cur_chapter + "/" + cur_section) if cur_section else cur_chapter
                anchor_line[sec_key + "/✦" + str(tilda_count)] = i
                tilda_count += 1

        # 앵커 위치 목록 (오프셋 초과 방지용)
        sorted_anchor_positions = sorted(anchor_line.values())

        # 삽입할 TABLE 태그 수집: {줄번호: [태그들]}
        injections: dict[int, list[str]] = {}
        for item in layout:
            # 신형: anchor 키 / 구형 호환: chapter 키
            anchor = item.get("anchor") or item.get("chapter", "")
            if anchor not in anchor_line:
                continue
            base = anchor_line[anchor]
            pos  = item.get("pos", "")
            if pos == "before":
                idx = base                       # 앵커 줄 앞에 삽입
            elif pos in ("after", "start_of"):
                idx = base + 1                   # 앵커 줄 바로 뒤
            elif pos == "offset":
                idx = base + 1 + item.get("offset", 0)  # 앵커+1+오프셋 번째 줄 앞
            else:
                idx = base                       # 기본: 앵커 앞
            # 오프셋이 다음 앵커를 넘지 않도록 보정 (회원마다 절 길이가 달라도 안전)
            next_anchor = next((p for p in sorted_anchor_positions if p > base), None)
            if next_anchor is not None and idx >= next_anchor:
                idx = next_anchor               # 다음 앵커 바로 앞으로 보정
            # cover는 엔진(run_all.js)이 항상 자동 삽입 → 레이아웃에서 제외
            tags = [f"[[TABLE:{t}]]\n" for t in item.get("tables", []) if t != "cover"]
            if not tags:
                continue
            # ◈ 마커가 있었던 경우 TABLE 앞에 ◈ 줄도 함께 삽입
            if item.get("has_marker"):
                tags = ["◈\n"] + tags
            injections.setdefault(idx, []).extend(tags)

        if not injections:
            return

        new_lines = []
        for i, line in enumerate(lines):
            if i in injections:
                new_lines.extend(injections[i])
            new_lines.append(line)

        result_path.write_text("".join(new_lines), encoding="utf-8")
        logging.info(f"TABLE 레이아웃 적용 완료: {len(injections)}개 앵커에 삽입")

    def _cleanup_queue(self, member_key: str):
        # 슬롯 폴더 방식: run_all.js가 중간파일을 자체 정리하므로 별도 처리 불필요
        # 레거시 flat 파일 잔재만 정리
        for p in self.queue_dir.glob(f"{member_key}_*"):
            try:
                if p.is_file(): p.unlink()
            except: pass


async def run_saju_background(book_id: int, member: dict, master_id: str, book_year: int,
                              on_complete=None, on_error=None, executor=None,
                              product_type: str = "saju_full",
                              partner_data: dict = None,
                              relationship_info: dict = None):
    loop = asyncio.get_event_loop()
    def _sync():
        writer = SajuWriter()
        return writer.write(member, master_id, book_id, book_year, product_type,
                            partner_data=partner_data, relationship_info=relationship_info)
    result = await loop.run_in_executor(executor, _sync)
    if result["success"] and on_complete: on_complete(result["output_path"], result["chars"])
    elif not result["success"] and on_error: on_error(result["error"])


if __name__ == "__main__":
    test_member = {"id":1,"master_id":"banya","name":"Hong_Gildong_Test","phone":"010-0000-0777","birth_year":1963,"birth_month":12,"birth_day":6,"birth_time":"사시","gender":"남","lunar_yn":1,"activity_type":"직장인","marital_status":"재혼","has_children":"있음","concern_area":"종합","has_siblings":"있음","parent_status":"양친","health_concern":"없음"}
    res = SajuWriter().write(test_member, "sample", 777, 2026)
    if res["success"]:
        msg = f"SUCCESS: {res['output_path']} ({res['chars']:,} chars)"
        print(msg.encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding))
    else:
        msg = f"FAILED: {res['error']}"
        print(msg.encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding))
