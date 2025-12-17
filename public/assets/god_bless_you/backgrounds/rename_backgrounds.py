import os
import sys

# ==========================================
# [설정] 테스트 모드 (True: 출력만 함 / False: 실제 변경)
DRY_RUN = False 
# ==========================================

# 파일명 매핑 데이터 (한글 -> 영어)
# 앞서 제안드린 리스트를 바탕으로 작성되었습니다.
rename_map = {
    # ==========================================
    # [추가] 이미지에서 확인된 배경 파일 매핑
    # ==========================================

    # 1. ⚔️ 던전 & 판타지 (Dungeon)
    "던전_쇼핑몰": "Dungeon_ShoppingMall_Ruined",
    "던전_침묵의 도서관": "Dungeon_Library_Silence",  # 무한의 도서관과 구분
    "던전_거울형": "Dungeon_Mirror_Room", 
    "잊혀진 대성당": "Dungeon_Ruins_Cathedral",
    
    # 2. 🏠 주거 공간 (Home)
    "반지하 자취방_화장실_낮": "Home_Bathroom_Basement", # 일반 화장실과 구분
    "한옥집": "Home_Hanok_Traditional",

    # 3. 🏙️ 도시 & 시설 (City & Facility)
    "암시장": "City_BlackMarket_Alley",
    "작은카페_낮": "City_Cafe_Cozy_Day",
    "작은카페_밤": "City_Cafe_Cozy_Night",
    "태닝 샵, 바디프로필 스튜디오": "Place_Studio_BodyProfile", # 쉼표 포함된 파일명 대응
    "전투의상 보관 창고": "Facility_Storage_CombatGear",
    
    # 4. 🚆 교통 (Transport)
    "버스_내부_밤": "Trans_Bus_Inside_Night", # 낮 버전과 구분
    "버스정류장_낮": "City_BusStop_Day",

    # 5. ✨ 럭셔리 & 기타 (Luxury & Etc)
    "프라이빗 아일랜드 리조트": "Luxury_Resort_Island",
    "시크릿 라운지_넥타르": "Luxury_Lounge_Secret",
    "코인노래방": "Ent_Room_Karaoke",
    "비상구 계단": "Building_Stairs_Emergency",
    "옥상 물탱크_올라섬": "Building_Rooftop_WaterTank",
}

def batch_rename():
    # 현재 스크립트가 있는 폴더 경로
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    print(f"📂 작업 폴더: {current_dir}")
    print(f"⚙️ 모드: {'[테스트 모드 - 변경 안됨]' if DRY_RUN else '[실제 실행 모드]'}")
    print("-" * 50)

    count = 0
    # 폴더 내의 모든 파일을 확인
    for filename in os.listdir(current_dir):
        # 파일명과 확장자 분리 (예: "반지하.png" -> "반지하", ".png")
        name, ext = os.path.splitext(filename)
        
        # 맵핑 테이블에 있는 이름인지 확인
        if name in rename_map:
            new_name_base = rename_map[name]
            new_filename = new_name_base + ext # 확장자는 그대로 유지
            
            old_path = os.path.join(current_dir, filename)
            new_path = os.path.join(current_dir, new_filename)

            # 이미 변경할 이름의 파일이 존재하는지 체크
            if os.path.exists(new_path):
                print(f"⚠️ [건너뜀] 대상 파일이 이미 존재함: {new_filename}")
                continue

            if DRY_RUN:
                print(f"🔍 [예상] {filename} -> {new_filename}")
            else:
                try:
                    os.rename(old_path, new_path)
                    print(f"✅ [변경] {filename} -> {new_filename}")
                except Exception as e:
                    print(f"❌ [에러] {filename} 변경 실패: {e}")
            
            count += 1
    
    print("-" * 50)
    if DRY_RUN:
        print(f"총 {count}개의 파일이 변경될 예정입니다.")
        print("실제로 변경하려면 코드 상단의 'DRY_RUN = False'로 수정하고 다시 실행하세요.")
    else:
        print(f"총 {count}개의 파일 이름을 변경했습니다.")

if __name__ == "__main__":
    batch_rename()