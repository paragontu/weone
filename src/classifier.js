// Nationwide Region, Local Government, Local Council & Committee Classifier

const REGIONS = [
  { code: '서울', name: '서울특별시', aliases: ['서울특별시', '서울시', '서울'] },
  { code: '경기', name: '경기도', aliases: ['경기도', '경기'] },
  { code: '인천', name: '인천광역시', aliases: ['인천광역시', '인천시', '인천'] },
  { code: '부산', name: '부산광역시', aliases: ['부산광역시', '부산시', '부산'] },
  { code: '대구', name: '대구광역시', aliases: ['대구광역시', '대구시', '대구'] },
  { code: '광주', name: '광주광역시', aliases: ['광주광역시', '광주시', '광주'] },
  { code: '대전', name: '대전광역시', aliases: ['대전광역시', '대전시', '대전'] },
  { code: '울산', name: '울산광역시', aliases: ['울산광역시', '울산시', '울산'] },
  { code: '세종', name: '세종특별자치시', aliases: ['세종특별자치시', '세종시', '세종'] },
  { code: '강원', name: '강원특별자치도', aliases: ['강원특별자치도', '강원도', '강원'] },
  { code: '충북', name: '충청북도', aliases: ['충청북도', '충북'] },
  { code: '충남', name: '충청남도', aliases: ['충청남도', '충남'] },
  { code: '전북', name: '전북특별자치도', aliases: ['전북특별자치도', '전라북도', '전북'] },
  { code: '전남', name: '전라남도', aliases: ['전라남도', '전남'] },
  { code: '경북', name: '경상북도', aliases: ['경상북도', '경북'] },
  { code: '경남', name: '경상남도', aliases: ['경상남도', '경남'] },
  { code: '제주', name: '제주특별자치도', aliases: ['제주특별자치도', '제주도', '제주'] }
];

// Mapping of major municipal domains & names to their parent 17-region code and normalized name
const MUNICIPALITY_MAP = {
  // 서울 (25개 자치구)
  'seoul.go.kr': { region: '서울', subRegion: '서울본청', orgName: '서울특별시청', orgType: '광역지자체' },
  'smc.seoul.kr': { region: '서울', subRegion: '서울시의회', orgName: '서울특별시의회', orgType: '광역의회' },
  'jongno.go.kr': { region: '서울', subRegion: '종로구', orgName: '종로구청' },
  'junggu.seoul.kr': { region: '서울', subRegion: '중구', orgName: '서울 중구청' },
  'yongsan.go.kr': { region: '서울', subRegion: '용산구', orgName: '용산구청' },
  'sd.go.kr': { region: '서울', subRegion: '성동구', orgName: '성동구청' },
  'gwangjin.go.kr': { region: '서울', subRegion: '광진구', orgName: '광진구청' },
  'ddm.go.kr': { region: '서울', subRegion: '동대문구', orgName: '동대문구청' },
  'jungnang.go.kr': { region: '서울', subRegion: '중랑구', orgName: '중랑구청' },
  'sb.go.kr': { region: '서울', subRegion: '성북구', orgName: '성북구청' },
  'gangbuk.go.kr': { region: '서울', subRegion: '강북구', orgName: '강북구청' },
  'dobong.go.kr': { region: '서울', subRegion: '도봉구', orgName: '도봉구청' },
  'nowon.kr': { region: '서울', subRegion: '노원구', orgName: '노원구청' },
  'ep.go.kr': { region: '서울', subRegion: '은평구', orgName: '은평구청' },
  'sdm.go.kr': { region: '서울', subRegion: '서대문구', orgName: '서대문구청' },
  'mapo.go.kr': { region: '서울', subRegion: '마포구', orgName: '마포구청' },
  'yangcheon.go.kr': { region: '서울', subRegion: '양천구', orgName: '양천구청' },
  'gangseo.seoul.kr': { region: '서울', subRegion: '강서구', orgName: '서울 강서구청' },
  'guro.go.kr': { region: '서울', subRegion: '구로구', orgName: '구로구청' },
  'geumcheon.go.kr': { region: '서울', subRegion: '금천구', orgName: '금천구청' },
  'ydp.go.kr': { region: '서울', subRegion: '영등포구', orgName: '영등포구청' },
  'dongjak.go.kr': { region: '서울', subRegion: '동작구', orgName: '동작구청' },
  'gwanak.go.kr': { region: '서울', subRegion: '관악구', orgName: '관악구청' },
  'seocho.go.kr': { region: '서울', subRegion: '서초구', orgName: '서초구청' },
  'gangnam.go.kr': { region: '서울', subRegion: '강남구', orgName: '강남구청' },
  'songpa.go.kr': { region: '서울', subRegion: '송파구', orgName: '송파구청' },
  'gangdong.go.kr': { region: '서울', subRegion: '강동구', orgName: '강동구청' },

  // 경기 (31개 시·군)
  'gg.go.kr': { region: '경기', subRegion: '경기본청', orgName: '경기도청', orgType: '광역지자체' },
  'ggc.go.kr': { region: '경기', subRegion: '경기도의회', orgName: '경기도의회', orgType: '광역의회' },
  'gccity.go.kr': { region: '경기', subRegion: '과천시', orgName: '과천시청' },
  'gccouncil.go.kr': { region: '경기', subRegion: '과천시의회', orgName: '과천시의회', orgType: '기초의회' },
  'suwon.go.kr': { region: '경기', subRegion: '수원시', orgName: '수원특례시청' },
  'suwoncouncil.go.kr': { region: '경기', subRegion: '수원시의회', orgName: '수원특례시의회', orgType: '기초의회' },
  'seongnam.go.kr': { region: '경기', subRegion: '성남시', orgName: '성남시청' },
  'sncouncil.go.kr': { region: '경기', subRegion: '성남시의회', orgName: '성남시의회', orgType: '기초의회' },
  'goyang.go.kr': { region: '경기', subRegion: '고양시', orgName: '고양특례시청' },
  'goyangcouncil.go.kr': { region: '경기', subRegion: '고양시의회', orgName: '고양특례시의회', orgType: '기초의회' },
  'yongin.go.kr': { region: '경기', subRegion: '용인시', orgName: '용인특례시청' },
  'hscity.go.kr': { region: '경기', subRegion: '화성시', orgName: '화성특례시청' },
  'hscc.go.kr': { region: '경기', subRegion: '화성시의회', orgName: '화성특례시의회', orgType: '기초의회' },
  'bucheon.go.kr': { region: '경기', subRegion: '부천시', orgName: '부천시청' },
  'ansan.go.kr': { region: '경기', subRegion: '안산시', orgName: '안산시청' },
  'anyang.go.kr': { region: '경기', subRegion: '안양시', orgName: '안양시청' },
  'aycouncil.go.kr': { region: '경기', subRegion: '안양시의회', orgName: '안양시의회', orgType: '기초의회' },
  'namyangju.go.kr': { region: '경기', subRegion: '남양주시', orgName: '남양주시청' },
  'pyeongtaek.go.kr': { region: '경기', subRegion: '평택시', orgName: '평택시청' },
  'siheung.go.kr': { region: '경기', subRegion: '시흥시', orgName: '시흥시청' },
  'gimpo.go.kr': { region: '경기', subRegion: '김포시', orgName: '김포시청' },
  'uijeongbu.go.kr': { region: '경기', subRegion: '의정부시', orgName: '의정부시청' },
  'paju.go.kr': { region: '경기', subRegion: '파주시', orgName: '파주시청' },
  'gjcity.go.kr': { region: '경기', subRegion: '광주시', orgName: '경기 광주시청' },
  'gm.go.kr': { region: '경기', subRegion: '광명시', orgName: '광명시청' },
  'gunpo.go.kr': { region: '경기', subRegion: '군포시', orgName: '군포시청' },
  'hanam.go.kr': { region: '경기', subRegion: '하남시', orgName: '하남시청' },
  'osan.go.kr': { region: '경기', subRegion: '오산시', orgName: '오산시청' },
  'icheon.go.kr': { region: '경기', subRegion: '이천시', orgName: '이천시청' },
  'anseong.go.kr': { region: '경기', subRegion: '안성시', orgName: '안성시청' },
  'uiwang.go.kr': { region: '경기', subRegion: '의왕시', orgName: '의왕시청' },
  'uwcouncil.go.kr': { region: '경기', subRegion: '의왕시의회', orgName: '의왕시의회', orgType: '기초의회' },
  'yangju.go.kr': { region: '경기', subRegion: '양주시', orgName: '양주시청' },
  'yp21.go.kr': { region: '경기', subRegion: '양평군', orgName: '양평군청' },
  'yeoju.go.kr': { region: '경기', subRegion: '여주시', orgName: '여주시청' },
  'pocheon.go.kr': { region: '경기', subRegion: '포천시', orgName: '포천시청' },
  'ddc.go.kr': { region: '경기', subRegion: '동두천시', orgName: '동두천시청' },
  'guri.go.kr': { region: '경기', subRegion: '구리시', orgName: '구리시청' },
  'gp.go.kr': { region: '경기', subRegion: '가평군', orgName: '가평군청' },
  'yeoncheon.go.kr': { region: '경기', subRegion: '연천군', orgName: '연천군청' },

  // 인천
  'incheon.go.kr': { region: '인천', subRegion: '인천본청', orgName: '인천광역시청', orgType: '광역지자체' },
  'icouncil.go.kr': { region: '인천', subRegion: '인천시의회', orgName: '인천광역시의회', orgType: '광역의회' },
  'yeonsu.go.kr': { region: '인천', subRegion: '연수구', orgName: '인천 연수구청' },
  'namdong.go.kr': { region: '인천', subRegion: '남동구', orgName: '인천 남동구청' },
  'bupyeong.go.kr': { region: '인천', subRegion: '부평구', orgName: '인천 부평구청' },
  'gyeyang.go.kr': { region: '인천', subRegion: '계양구', orgName: '인천 계양구청' },
  'seo.incheon.kr': { region: '인천', subRegion: '서구', orgName: '인천 서구청' },
  'michuhol.go.kr': { region: '인천', subRegion: '미추홀구', orgName: '인천 미추홀구청' },
  'icjg.go.kr': { region: '인천', subRegion: '중구', orgName: '인천 중구청' },
  'icdonggu.go.kr': { region: '인천', subRegion: '동구', orgName: '인천 동구청' },
  'ganghwa.go.kr': { region: '인천', subRegion: '강화군', orgName: '강화군청' },
  'ongjin.go.kr': { region: '인천', subRegion: '옹진군', orgName: '옹진군청' },

  // 부산 / 대구 / 광주 / 대전 / 울산 / 세종
  'busan.go.kr': { region: '부산', subRegion: '부산본청', orgName: '부산광역시청', orgType: '광역지자체' },
  'daegu.go.kr': { region: '대구', subRegion: '대구본청', orgName: '대구광역시청', orgType: '광역지자체' },
  'gwangju.go.kr': { region: '광주', subRegion: '광주본청', orgName: '광주광역시청', orgType: '광역지자체' },
  'daejeon.go.kr': { region: '대전', subRegion: '대전본청', orgName: '대전광역시청', orgType: '광역지자체' },
  'ulsan.go.kr': { region: '울산', subRegion: '울산본청', orgName: '울산광역시청', orgType: '광역지자체' },
  'sejong.go.kr': { region: '세종', subRegion: '세종본청', orgName: '세종특별자치시청', orgType: '광역지자체' },

  // 도청 및 주요 시·군
  'gwd.go.kr': { region: '강원', subRegion: '강원본청', orgName: '강원특별자치도청', orgType: '광역지자체' },
  'provin.gangwon.kr': { region: '강원', subRegion: '강원본청', orgName: '강원특별자치도청', orgType: '광역지자체' },
  'yanggu.go.kr': { region: '강원', subRegion: '양구군', orgName: '양구군청' },
  'chuncheon.go.kr': { region: '강원', subRegion: '춘천시', orgName: '춘천시청' },
  'wonju.go.kr': { region: '강원', subRegion: '원주시', orgName: '원주시청' },
  'gangneung.go.kr': { region: '강원', subRegion: '강릉시', orgName: '강릉시청' },

  'chungbuk.go.kr': { region: '충북', subRegion: '충북본청', orgName: '충청북도청', orgType: '광역지자체' },
  'cheongju.go.kr': { region: '충북', subRegion: '청주시', orgName: '청주시청' },
  'chungju.go.kr': { region: '충북', subRegion: '충주시', orgName: '충주시청' },
  'yd21.go.kr': { region: '충북', subRegion: '영동군', orgName: '영동군청' },

  'chungnam.go.kr': { region: '충남', subRegion: '충남본청', orgName: '충청남도청', orgType: '광역지자체' },
  'cheonan.go.kr': { region: '충남', subRegion: '천안시', orgName: '천안시청' },
  'asan.go.kr': { region: '충남', subRegion: '아산시', orgName: '아산시청' },
  'gongju.go.kr': { region: '충남', subRegion: '공주시', orgName: '공주시청' },

  'jeonbuk.go.kr': { region: '전북', subRegion: '전북본청', orgName: '전북특별자치도청', orgType: '광역지자체' },
  'jeonju.go.kr': { region: '전북', subRegion: '전주시', orgName: '전주시청' },
  'iksan.go.kr': { region: '전북', subRegion: '익산시', orgName: '익산시청' },
  'gunsan.go.kr': { region: '전북', subRegion: '군산시', orgName: '군산시청' },

  'jeonnam.go.kr': { region: '전남', subRegion: '전남본청', orgName: '전라남도청', orgType: '광역지자체' },
  'suncheon.go.kr': { region: '전남', subRegion: '순천시', orgName: '순천시청' },
  'yeosu.go.kr': { region: '전남', subRegion: '여수시', orgName: '여수시청' },
  'mokpo.go.kr': { region: '전남', subRegion: '목포시', orgName: '목포시청' },
  'naju.go.kr': { region: '전남', subRegion: '나주시', orgName: '나주시청' },
  'yeonggwang.go.kr': { region: '전남', subRegion: '영광군', orgName: '영광군청' },

  'gb.go.kr': { region: '경북', subRegion: '경북본청', orgName: '경상북도청', orgType: '광역지자체' },
  'pohang.go.kr': { region: '경북', subRegion: '포항시', orgName: '포항시청' },
  'gumi.go.kr': { region: '경북', subRegion: '구미시', orgName: '구미시청' },
  'gyeongju.go.kr': { region: '경북', subRegion: '경주시', orgName: '경주시청' },
  'andong.go.kr': { region: '경북', subRegion: '안동시', orgName: '안동시청' },

  'gyeongnam.go.kr': { region: '경남', subRegion: '경남본청', orgName: '경상남도청', orgType: '광역지자체' },
  'changwon.go.kr': { region: '경남', subRegion: '창원시', orgName: '창원특례시청' },
  'gimhae.go.kr': { region: '경남', subRegion: '김해시', orgName: '김해시청' },
  'jinju.go.kr': { region: '경남', subRegion: '진주시', orgName: '진주시청' },
  'yangsan.go.kr': { region: '경남', subRegion: '양산시', orgName: '양산시청' },

  'jeju.go.kr': { region: '제주', subRegion: '제주본청', orgName: '제주특별자치도청', orgType: '광역지자체' }
};

// Nationwide city/county/district name -> parent region mapping for text/brand fallback
const SUBREGION_TO_REGION = {
  // 경기
  '과천': '경기', '수원': '경기', '성남': '경기', '고양': '경기', '용인': '경기', '화성': '경기',
  '부천': '경기', '안산': '경기', '안양': '경기', '남양주': '경기', '평택': '경기', '시흥': '경기',
  '김포': '경기', '의정부': '경기', '파주': '경기', '광명': '경기', '군포': '경기', '하남': '경기',
  '오산': '경기', '이천': '경기', '안성': '경기', '의왕': '경기', '양주': '경기', '양평': '경기',
  '여주': '경기', '포천': '경기', '동두천': '경기', '구리': '경기', '가평': '경기', '연천': '경기',
  '수지': '경기', '기흥': '경기', '처인': '경기', '분당': '경기', '일산': '경기', '덕양': '경기',
  '영통': '경기', '팔달': '경기', '권선': '경기', '장안': '경기', '동안': '경기', '만안': '경기',
  '단원': '경기', '상록': '경기',
  // 서울
  '종로': '서울', '용산': '서울', '성동': '서울', '광진': '서울', '동대문': '서울', '중랑': '서울',
  '성북': '서울', '강북': '서울', '도봉': '서울', '노원': '서울', '은평': '서울', '서대문': '서울',
  '마포': '서울', '양천': '서울', '구로': '서울', '금천': '서울', '영등포': '서울', '동작': '서울',
  '관악': '서울', '서초': '서울', '강남': '서울', '송파': '서울', '강동': '서울',
  // 인천
  '연수': '인천', '남동': '인천', '부평': '인천', '계양': '인천', '미추홀': '인천', '강화': '인천', '옹진': '인천',
  // 부산
  '해운대': '부산', '부산진': '부산', '동래': '부산', '남구': '부산', '사하': '부산', '금정': '부산',
  '연제': '부산', '수영': '부산', '사상': '부산', '기장': '부산', '영도': '부산',
  // 대구
  '수성': '대구', '달서': '대구', '달성': '대구', '군위': '대구',
  // 광주
  '광산': '광주',
  // 대전
  '유성': '대전', '대덕': '대전',
  // 울산
  '울주': '울산',
  // 강원
  '춘천': '강원', '원주': '강원', '강릉': '강원', '동해': '강원', '태백': '강원', '속초': '강원',
  '삼척': '강원', '홍천': '강원', '횡성': '강원', '영월': '강원', '평창': '강원', '정선': '강원',
  '철원': '강원', '화천': '강원', '양구': '강원', '인제': '강원', '고성': '강원', '양양': '강원',
  // 충북
  '청주': '충북', '충주': '충북', '제천': '충북', '보은': '충북', '옥천': '충북', '영동': '충북',
  '증평': '충북', '진천': '충북', '괴산': '충북', '음성': '충북', '단양': '충북',
  // 충남
  '천안': '충남', '공주': '충남', '보령': '충남', '아산': '충남', '서산': '충남', '논산': '충남',
  '계룡': '충남', '당진': '충남', '금산': '충남', '부여': '충남', '서천': '충남', '청양': '충남',
  '홍성': '충남', '예산': '충남', '태안': '충남',
  // 전북
  '전주': '전북', '군산': '전북', '익산': '전북', '정읍': '전북', '남원': '전북', '김제': '전북',
  '완주': '전북', '진안': '전북', '무주': '전북', '장수': '전북', '임실': '전북', '순창': '전북',
  '고창': '전북', '부안': '전북',
  // 전남
  '목포': '전남', '여수': '전남', '순천': '전남', '나주': '전남', '광양': '전남', '담양': '전남',
  '곡성': '전남', '구례': '전남', '고흥': '전남', '보성': '전남', '화순': '전남', '장흥': '전남',
  '강진': '전남', '해남': '전남', '영암': '전남', '무안': '전남', '함평': '전남', '영광': '전남',
  '장성': '전남', '완도': '전남', '진도': '전남', '신안': '전남',
  // 경북
  '포항': '경북', '경주': '경북', '김천': '경북', '안동': '경북', '구미': '경북', '영주': '경북',
  '영천': '경북', '상주': '경북', '문경': '경북', '경산': '경북', '의성': '경북', '청송': '경북',
  '영양': '경북', '영덕': '경북', '청도': '경북', '고령': '경북', '성주': '경북', '칠곡': '경북',
  '예천': '경북', '봉화': '경북', '울진': '경북', '울릉': '경북',
  // 경남
  '창원': '경남', '진주': '경남', '통영': '경남', '사천': '경남', '김해': '경남', '밀양': '경남',
  '거제': '경남', '양산': '경남', '의령': '경남', '함안': '경남', '창녕': '경남', '고성': '경남',
  '남해': '경남', '하동': '경남', '산청': '경남', '함양': '경남', '거창': '경남', '합천': '경남',
  // 제주
  '서귀포': '제주'
};

/**
 * Checks whether a notice title & snippet actually represent a committee member recruitment
 * (민간위원, 심의위원, 평가위원, 자문위원, 결산검사위원, 의회 위원 등 모집/위촉/추천 공고)
 */
function isValidCommitteeNotice(title = '', snippet = '') {
  const combined = `${title} ${snippet}`;
  const t = title.trim();

  if (t.length < 6 || /^https?:\/\/|^www\.|\.go\.kr$/i.test(t)) return false;

  // Must mention 위원 / 옴부즈만 / 협의체 / 모니터단 / 자문단 / 심사단 in title or strongly in combined
  const hasCommitteeWord = /(위원|옴부즈만|협의체|자문단|심사단|평가단)/.test(t) ||
                           /(심의위원|평가위원|자문위원|민간위원|결산검사위원)/.test(combined);
  if (!hasCommitteeWord) return false;

  // Must indicate recruitment / public offering (모집, 공개모집, 공모, 위촉, 추천, 후보자)
  const hasRecruitWord = /(모집|공개\s*모집|공모|초빙|후보자|추천)/.test(combined);
  if (!hasRecruitWord) return false;

  // Exclude regular civil servant / employee / worker hiring or photo/ceremony notices
  const excludePatterns = [
    /임기제\s*공무원\s*(임용|채용)/,
    /공무원\s*(경력경쟁|공개경쟁|임용시험)/,
    /연구위원\s*채용/,
    /전문위원\s*채용/,
    /기간제\s*근로자\s*채용/,
    /공무직\s*근로자\s*채용/,
    /위촉식/,
    /발대식/,
    /의정포토/,
    /포토뉴스/,
    /언론\s*보도자료/,
    /심의신청서/,
    /심의\s*신청\s*안내/,
    /생활임금\s*고시/,
    /도로점용/,
    /수용재결/,
    /공시송달/,
    /최종\s*합격자\s*공고/,
    /서류전형\s*합격자/,
    /선정\s*결과\s*공고/,
    /위촉\s*결과/
  ];
  for (const pat of excludePatterns) {
    if (pat.test(t)) return false;
  }

  return true;
}

/**
 * Identifies Region, SubRegion, Organization Name, and Organization Type from URL, Brand, Title, and Snippet
 */
function classifyOrganization(url = '', brand = '', title = '', snippet = '') {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {}

  const combinedText = `${brand} ${title} ${snippet}`;
  const isCouncilDomain = /(council|assembly|clik)/i.test(host) || host.includes('smc.seoul') || host.includes('ggc.go.kr');
  const isCouncilText = /(도의회|시의회|구의회|군의회|특별시의회|광역시의회|자치시의회|자치도의회)/.test(`${brand} ${title}`);

  // 1. Check exact or suffix domain match in MUNICIPALITY_MAP
  let matchedInfo = null;
  for (const [domainKey, info] of Object.entries(MUNICIPALITY_MAP)) {
    if (host === domainKey || host.endsWith('.' + domainKey)) {
      matchedInfo = { ...info };
      break;
    }
  }

  let region = matchedInfo?.region || '';
  let subRegion = matchedInfo?.subRegion || '';
  let orgName = matchedInfo?.orgName || brand || '';
  let orgType = matchedInfo?.orgType || '';

  // 2. Check explicit region names in brand/title
  if (!region) {
    for (const r of REGIONS) {
      if (r.aliases.some(a => brand.includes(a) || title.includes(a))) {
        region = r.code;
        break;
      }
    }
  }

  // 3. Check subregion names in brand/title/snippet
  for (const [subName, regCode] of Object.entries(SUBREGION_TO_REGION)) {
    const regex = new RegExp(`(${subName}(?:특례)?(?:시|군|구)(?:의회|청)?)`);
    const m = `${brand} ${title}`.match(regex);
    if (m) {
      if (!region) region = regCode;
      if (!subRegion || subRegion.endsWith('본청')) {
        subRegion = m[1].replace(/청$/, '');
      }
      if (!orgName || orgName === brand) {
        orgName = brand || m[1];
      }
      break;
    }
  }

  // 4. Determine orgType accurately (광역지자체, 기초지자체, 광역의회, 기초의회)
  if (isCouncilDomain || isCouncilText) {
    const isMetroCouncil = /(서울특별시의회|서울시의회|경기도의회|인천광역시의회|인천시의회|부산광역시의회|부산시의회|대구광역시의회|대구시의회|광주광역시의회|광주시의회|대전광역시의회|대전시의회|울산광역시의회|울산시의회|세종특별자치시의회|세종시의회|강원특별자치도의회|강원도의회|충청북도의회|충북도의회|충청남도의회|충남도의회|전북특별자치도의회|전라북도의회|전라남도의회|전남도의회|경상북도의회|경북도의회|경상남도의회|경남도의회|제주특별자치도의회|제주도의회)/.test(`${brand} ${title}`);
    orgType = isMetroCouncil ? '광역의회' : '기초의회';

    // Try to refine council orgName from title if brand was generic
    const councilNameMatch = `${brand} ${title}`.match(/([가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도|특례시|시|군|구)의회)/);
    if (councilNameMatch) {
      orgName = councilNameMatch[1];
      if (!subRegion) subRegion = councilNameMatch[1];
    }
  } else if (!orgType) {
    const isMetroGov = /(특별시청|광역시청|특별자치시청|도청|특별자치도청|^서울시청$|^부산시청$|^대구시청$|^인천시청$|^광주시청$|^대전시청$|^울산시청$|^세종시청$)/.test(orgName);
    orgType = isMetroGov ? '광역지자체' : '기초지자체';
  }

  if (!region) region = '기타';
  if (!orgName) orgName = host || '지자체';
  if (!subRegion) subRegion = orgName.replace(/(시청|군청|구청|청)$/, '$1');

  return { region, subRegion, orgName, orgType };
}

/**
 * Classifies the committee type and specialty fields
 */
function classifyCommittee(title = '', snippet = '', orgType = '') {
  const text = `${title} ${snippet}`;

  let category = '심의위원회';
  if (orgType === '광역의회' || orgType === '기초의회' || /(의회|공무국외출장|의원연구단체|윤리심사|결산검사위원|의정모니터)/.test(text)) {
    if (/(공무국외출장|의원연구단체|윤리심사|결산검사|의정|의회)/.test(title)) {
      category = '의회위원';
    }
  }
  if (category !== '의회위원') {
    if (/(제안서\s*평가|평가위원|심사위원\s*후보자|기술평가)/.test(text)) {
      category = '평가위원회';
    } else if (/(자문위원|자문단|정책자문|고문변호사|고문세무사)/.test(text)) {
      category = '자문위원회';
    } else if (/(주민참여예산|지역사회보장협의체|협의체|옴부즈만|시민고충|주민자치|모니터)/.test(text)) {
      category = '주민참여·협의체';
    } else if (/(인사위원회|징계위원회|성희롱|노사|임금|복무)/.test(text)) {
      category = '인사·기타위원회';
    } else {
      category = '심의위원회';
    }
  }

  const fields = [];
  if (/(민간위탁|수탁기관|성과평가|계약심의|보조금|예산|결산|재정|회계|세무|법률|법무|행정|규제|적극행정|공무국외출장|의원연구)/.test(text)) {
    fields.push('행정·예산·위탁');
  }
  if (/(건축|도시계획|도시관리|경관|교통|도로|주택|재개발|재건축|공동주택|토지|지명|시설|엔지니어링|건설|안전진단)/.test(text)) {
    fields.push('건축·도시·교통');
  }
  if (/(복지|보육|아동|청소년|청년|여성|가족|노인|중장년|50플러스|장애인|교육|장학|평생학습|학교|지역사회보장|보건|의료|치매)/.test(text)) {
    fields.push('복지·교육·청년');
  }
  if (/(일자리|경제|산업|기업|소상공인|상권|농업|농촌|축산|수산|고용|노동|취업|창업|투자)/.test(text)) {
    fields.push('일자리·경제·산업');
  }
  if (/(문화|예술|관광|축제|체육|스포츠|도서관|박물관|미술관|유산|콘텐츠|홍보|영상|디자인)/.test(text)) {
    fields.push('문화·관광·체육');
  }
  if (/(환경|기후|탄소|에너지|하수|상수도|수질|폐기물|자원|녹지|공원|산림|재난|안전)/.test(text)) {
    fields.push('환경·안전·기술');
  }
  if (/(정보화|스마트|데이터|AI|인공지능|전산|시스템|소프트웨어|SW|통신|보안|개인정보|디지털)/.test(text)) {
    fields.push('IT·정보화');
  }

  if (fields.length === 0) {
    fields.push('행정·예산·위탁');
  }

  return { category, fields };
}

function isPlausibleRecruitmentSpan(y1, m1, d1, y2, m2, d2) {
  const t1 = new Date(`${y1}-${String(m1).padStart(2, '0')}-${String(d1).padStart(2, '0')}T00:00:00Z`).getTime();
  const t2 = new Date(`${y2}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}T00:00:00Z`).getTime();
  if (isNaN(t1) || isNaN(t2)) return false;
  const spanDays = (t2 - t1) / 86400000;
  // Recruitment periods are between 0 and 90 days (never 1~2 year committee terms)
  return spanDays >= 0 && spanDays <= 90;
}

function parseDateRangeFromLine(line = '', defaultYear = 2026) {
  const norm = line.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. YYYY. M. D. ~ YYYY. M. D. (or YYYY-MM-DD ~ YYYY-MM-DD or YYYY년 M월 D일 ~ YYYY년 M월 D일)
  const fullRange = norm.match(
    /(20\d{2})\s*(?:[-./년]\s*)(\d{1,2})\s*(?:[-./월]\s*)(\d{1,2})\s*일?\.?\s*(?:\([^)]*\))?\s*(?:\d{1,2}:\d{2})?\s*(?:[~∼～〜﹣－-]|부터)\s*(20\d{2})\s*(?:[-./년]\s*)(\d{1,2})\s*(?:[-./월]\s*)(\d{1,2})\s*일?\.?(?:\s*\([^)]*\))?(?:\s*\d{1,2}:\d{2}|\s*(?:오전|오후)\s*\d+시(?:\s*\d+분)?(?:\s*까지)?)?/
  );
  if (fullRange) {
    const y1 = Number(fullRange[1]), m1 = Number(fullRange[2]), d1 = Number(fullRange[3]);
    const y2 = Number(fullRange[4]), m2Num = Number(fullRange[5]), d2Num = Number(fullRange[6]);
    if (isPlausibleRecruitmentSpan(y1, m1, d1, y2, m2Num, d2Num)) {
      return {
        periodText: fullRange[0].trim(),
        deadline: `${y2}-${String(m2Num).padStart(2, '0')}-${String(d2Num).padStart(2, '0')}`
      };
    }
  }

  // 2. YYYY. M. D. ~ M. D. (or YYYY년 M월 D일 ~ M월 D일)
  const shortYearRange = norm.match(
    /(20\d{2})\s*(?:[-./년]\s*)(\d{1,2})\s*(?:[-./월]\s*)(\d{1,2})\s*일?\.?\s*(?:\([^)]*\))?\s*(?:\d{1,2}:\d{2})?\s*(?:[~∼～〜﹣－-]|부터)\s*(\d{1,2})\s*(?:[-./월]\s*)(\d{1,2})\s*일?\.?(?:\s*\([^)]*\))?(?:\s*\d{1,2}:\d{2}|\s*(?:오전|오후)\s*\d+시(?:\s*\d+분)?(?:\s*까지)?)?/
  );
  if (shortYearRange) {
    const y1 = Number(shortYearRange[1]), m1 = Number(shortYearRange[2]), d1 = Number(shortYearRange[3]);
    let y2 = y1;
    const m2Num = Number(shortYearRange[4]), d2Num = Number(shortYearRange[5]);
    if (m2Num < m1) y2 += 1;
    if (isPlausibleRecruitmentSpan(y1, m1, d1, y2, m2Num, d2Num)) {
      return {
        periodText: shortYearRange[0].trim(),
        deadline: `${y2}-${String(m2Num).padStart(2, '0')}-${String(d2Num).padStart(2, '0')}`
      };
    }
  }

  // 3. No year: M월 D일 ~ M월 D일 or M. D. ~ M. D.
  const noYearRange = norm.match(
    /(?:^|[^\d.])(\d{1,2})\s*(?:월|\.)\s*(\d{1,2})\s*일?\.?\s*(?:\([^)]*\))?\s*(?:[~∼～〜﹣－-]|부터)\s*(\d{1,2})\s*(?:월|\.)\s*(\d{1,2})\s*일?\.?(?:\s*\([^)]*\))?(?:\s*\d{1,2}:\d{2}|\s*(?:오전|오후)\s*\d+시(?:\s*\d+분)?(?:\s*까지)?)?/
  );
  if (noYearRange) {
    const m1 = Number(noYearRange[1]), d1 = Number(noYearRange[2]);
    const m2Num = Number(noYearRange[3]), d2Num = Number(noYearRange[4]);
    let y2 = defaultYear;
    if (m2Num < m1) y2 += 1;
    if (isPlausibleRecruitmentSpan(defaultYear, m1, d1, y2, m2Num, d2Num)) {
      return {
        periodText: noYearRange[0].trim(),
        deadline: `${y2}-${String(m2Num).padStart(2, '0')}-${String(d2Num).padStart(2, '0')}`
      };
    }
  }

  // 4. Single deadline date with '까지' or '마감' (with year)
  const untilFull = norm.match(
    /(20\d{2})\s*(?:[-./년]\s*)(\d{1,2})\s*(?:[-./월]\s*)(\d{1,2})\s*일?\.?\s*(?:\([^)]*\))?\s*(?:\d{1,2}:\d{2}|\s*(?:오전|오후)\s*\d+시)?\s*까지/
  );
  if (untilFull) {
    const y2 = untilFull[1];
    const m2 = String(untilFull[2]).padStart(2, '0');
    const d2 = String(untilFull[3]).padStart(2, '0');
    return {
      periodText: `~ ${untilFull[0].trim()}`,
      deadline: `${y2}-${m2}-${d2}`
    };
  }

  // 5. Single deadline date with '까지' (month & day only, e.g. "오는 11월 9일까지")
  const untilShort = norm.match(
    /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?:\([^)]*\))?\s*(?:\d{1,2}:\d{2}|\s*(?:오전|오후)\s*\d+시)?\s*까지/
  );
  if (untilShort) {
    const m2Num = Number(untilShort[1]), d2Num = Number(untilShort[2]);
    if (m2Num >= 1 && m2Num <= 12 && d2Num >= 1 && d2Num <= 31) {
      return {
        periodText: `~ ${untilShort[0].trim()}`,
        deadline: `${defaultYear}-${String(m2Num).padStart(2, '0')}-${String(d2Num).padStart(2, '0')}`
      };
    }
  }

  return null;
}

/**
 * Parses published date (including relative Korean strings like '오늘', '3일 전', '2주 전', '2026. 11. 06.')
 * and extracts recruitment deadline / metadata from text
 */
function extractDatesAndMeta(dateRaw = '', text = '', referenceDate = new Date()) {
  let publishedAt = null;
  const cleanDate = (dateRaw || '').replace(/\u00a0/g, ' ').trim();
  const normText = (text || '').replace(/\u00a0/g, ' ');

  if (/오늘|시간\s*전|시간\s*이내|분\s*전/.test(cleanDate)) {
    publishedAt = new Date(referenceDate);
  } else if (/어제/.test(cleanDate)) {
    publishedAt = new Date(referenceDate.getTime() - 86400000);
  } else if (/(\d+)\s*일\s*전/.test(cleanDate)) {
    const days = parseInt(cleanDate.match(/(\d+)\s*일\s*전/)[1], 10);
    publishedAt = new Date(referenceDate.getTime() - days * 86400000);
  } else if (/(\d+)\s*주\s*전/.test(cleanDate)) {
    const weeks = parseInt(cleanDate.match(/(\d+)\s*주\s*전/)[1], 10);
    publishedAt = new Date(referenceDate.getTime() - weeks * 7 * 86400000);
  } else {
    const m = cleanDate.match(/(20\d{2})[-./\s년]+(\d{1,2})[-./\s월]+(\d{1,2})/);
    if (m) {
      publishedAt = new Date(`${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}T09:00:00+09:00`);
    }
  }

  if (!publishedAt || isNaN(publishedAt.getTime())) {
    const m2 = normText.match(/(?:등록일|작성일|게시일자?|제공일자?|공고일)\s*[:：]?\s*(20\d{2})[-./\s]+(\d{1,2})[-./\s]+(\d{1,2})/) ||
               normText.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (m2) {
      publishedAt = new Date(`${m2[1]}-${String(m2[2]).padStart(2, '0')}-${String(m2[3]).padStart(2, '0')}T09:00:00+09:00`);
    } else {
      publishedAt = new Date(referenceDate);
    }
  }

  const publishedDateStr = publishedAt.toISOString().slice(0, 10);
  const pubYear = publishedAt.getFullYear();

  let deadline = null;
  let periodText = '';

  // Split text into lines/clauses (never split on YYYY. MM. DD. dates!)
  const lines = normText.split(/\n|(?=\s(?:[가-하]|[1-9])\.\s*[가-힣]|[○❍□■▸•]\s)/);
  const priorityLines = [];
  const normalLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // Skip lines that explicitly describe committee term or project duration
    if (/(사업\s*기간|위촉\s*기간|위원\s*임기|임\s*기|운영\s*기간|수행\s*기간|협약\s*기간|위탁\s*기간)/.test(line) &&
        !/(접수\s*기간|모집\s*기간|신청\s*기간|공고\s*기간)/.test(line)) {
      continue;
    }
    if (/(접수\s*기간|모집\s*기간|신청\s*기간|제출\s*기간|공고\s*기간|게재\s*기간|원서\s*접수|접수\s*기한|모집\s*기한|기\s*간\s*[:：])/.test(line)) {
      priorityLines.push(line);
    } else {
      normalLines.push(line);
    }
  }

  for (const pLine of [...priorityLines, ...normalLines]) {
    const parsed = parseDateRangeFromLine(pLine, pubYear);
    if (parsed) {
      deadline = parsed.deadline;
      periodText = parsed.periodText;
      break;
    }
  }

  // Quota (모집인원)
  const quotaMatch = text.match(/(?:모집인원|선정인원|위촉인원|모집규모)\s*[:：]?\s*([^\n,;○□■]{1,22})/);
  const quota = quotaMatch ? quotaMatch[1].replace(/\s*\d+\.\s*[가-힣].*$/, '').trim() : '';

  // Apply Method (접수방법)
  const methodMatch = text.match(/(?:접수방법|제출방법|신청방법)\s*[:：]?\s*([^\n□■]{2,42})/);
  const applyMethod = methodMatch ? methodMatch[1].replace(/\s*(?:\d+\.|[가-하]\.)\s*[가-힣].*$/, '').trim() : '';

  // Department / Contact (담당부서/문의)
  const contactMatch = text.match(/(?:담당\s*부서(?:\(연락처\))?|문의처?|연락처)\s*[:：]?\s*([^\n□■]{3,42})/);
  const contact = contactMatch ? contactMatch[1].replace(/\s*(?:\d+\.|[가-하]\.|※).*$/, '').trim() : '';

  // Notice Number (공고번호)
  const docNoMatch = text.match(/([가-힣\s]+공고\s*제\s*20\d{2}\s*-\s*\d+\s*호)/);
  const docNo = docNoMatch ? docNoMatch[1].replace(/\s+/g, ' ').trim() : '';

  return {
    publishedDate: publishedDateStr,
    deadline,
    periodText,
    quota,
    applyMethod,
    contact,
    docNo
  };
}

module.exports = {
  REGIONS,
  MUNICIPALITY_MAP,
  isValidCommitteeNotice,
  classifyOrganization,
  classifyCommittee,
  extractDatesAndMeta
};
