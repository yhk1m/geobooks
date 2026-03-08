/**
 * GeoShelf - Google Apps Script Backend
 *
 * 사용법:
 * 1. Google 스프레드시트를 새로 만듭니다.
 * 2. [확장 프로그램] > [Apps Script]를 클릭합니다.
 * 3. 이 코드를 전체 붙여넣기합니다.
 * 4. 아래 CONFIG.SPREADSHEET_ID에 스프레드시트 ID를 입력합니다.
 *    (스프레드시트 URL에서 /d/ 와 /edit 사이의 문자열)
 * 5. setup() 함수를 한 번 실행하여 시트를 초기화합니다.
 * 6. [배포] > [새 배포] > 유형: 웹 앱
 *    - 실행 사용자: 나
 *    - 액세스 권한: 모든 사용자
 * 7. 배포 URL을 복사하여 프론트엔드 config.js의 API_URL에 입력합니다.
 */

const CONFIG = {
  SPREADSHEET_ID: '1joMA86DKXxA6-sZegFnaOjI-gI5J_Ah6elQc1RWm8Gs',
  ADMIN_PASSWORD: 'geo1234',
  ADMIN_EMAIL: 'bgnlkim@gmail.com'
};

const BOOKS_SHEET = '도서목록';
const PENDING_SHEET = '대기목록';
const TRASH_SHEET = '휴지통';
const STATS_SHEET = '조회수';
const BOOK_HEADERS = ['ID', '표지URL', '도서명', '부제', '저자', '출판사', '출판일', 'ISBN', '교보문고', 'Yes24', '알라딘', '기타', '수준별', '내용별', '등록일', '지정도서목록1', '지정도서목록2', '지정도서목록3', '지정도서목록4', '지정도서목록5'];

// ========== Routing ==========

function doGet(e) {
  const params = e.parameter;
  let result;

  try {
    switch (params.action) {
      case 'getBooks':
        result = getBooks();
        break;
      case 'getPending':
        if (params.password !== CONFIG.ADMIN_PASSWORD) {
          result = { success: false, error: '권한이 없습니다.' };
          break;
        }
        result = getPending();
        break;
      case 'getStats':
        result = getStats();
        break;
      default:
        result = { success: false, error: 'Invalid action' };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  let result;

  try {
    switch (data.action) {
      case 'register':
        result = registerBook(data);
        break;
      case 'approve':
        if (data.password !== CONFIG.ADMIN_PASSWORD) {
          result = { success: false, error: '권한이 없습니다.' };
          break;
        }
        result = approveBook(data.id);
        break;
      case 'reject':
        if (data.password !== CONFIG.ADMIN_PASSWORD) {
          result = { success: false, error: '권한이 없습니다.' };
          break;
        }
        result = rejectBook(data.id);
        break;
      case 'delete':
        if (data.password !== CONFIG.ADMIN_PASSWORD) {
          result = { success: false, error: '권한이 없습니다.' };
          break;
        }
        result = deleteBook(data.id);
        break;
      case 'edit':
        if (data.password !== CONFIG.ADMIN_PASSWORD) {
          result = { success: false, error: '권한이 없습니다.' };
          break;
        }
        result = editBook(data);
        break;
      case 'addView':
        result = addView();
        break;
      default:
        result = { success: false, error: 'Invalid action' };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== Sheet Helpers ==========

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === STATS_SHEET) {
      sheet.appendRow(['date', 'today_count', 'total_count']);
      sheet.appendRow([getTodayStr(), 0, 0]);
    } else if (name === TRASH_SHEET) {
      sheet.appendRow(BOOK_HEADERS.concat(['삭제일']));
    } else {
      sheet.appendRow(BOOK_HEADERS);
    }
  }

  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  return data.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function getTodayStr() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
}

// ========== CRUD Operations ==========

function getBooks() {
  var sheet = getOrCreateSheet(BOOKS_SHEET);
  return { success: true, books: sheetToObjects(sheet) };
}

function getPending() {
  var sheet = getOrCreateSheet(PENDING_SHEET);
  return { success: true, books: sheetToObjects(sheet) };
}

function registerBook(data) {
  var sheet = getOrCreateSheet(PENDING_SHEET);

  var imageUrl = data.coverUrl || '';
  var id = 'B' + Date.now();
  var now = getTodayStr();

  sheet.appendRow([
    id,
    imageUrl,
    data.title || '',
    data.subtitle || '',
    data.author || '',
    data.publisher || '',
    data.pubDate || '',
    data.isbn || '',
    data.linkKyobo || '',
    data.linkYes24 || '',
    data.linkAladin || '',
    data.linkEtc || '',
    data.level || '',
    data.content || '',
    now,
    '', '', '', '', ''
  ]);

  // Send email notification
  try {
    MailApp.sendEmail({
      to: CONFIG.ADMIN_EMAIL,
      subject: '[GeoShelf] 새 도서 등록 요청: ' + (data.title || '제목 없음'),
      body: '새로운 도서 등록 요청이 있습니다.\n\n'
        + '도서명: ' + (data.title || '') + '\n'
        + '부제: ' + (data.subtitle || '') + '\n'
        + '저자: ' + (data.author || '') + '\n'
        + '출판사: ' + (data.publisher || '') + '\n'
        + '출판일: ' + (data.pubDate || '') + '\n'
        + 'ISBN: ' + (data.isbn || '') + '\n'
        + '수준별: ' + (data.level || '') + '\n'
        + '내용별: ' + (data.content || '') + '\n'
        + '등록일: ' + now + '\n\n'
        + '관리자 페이지에서 승인해주세요.\n'
        + 'https://geoshelf.kr/admin.html'
    });
  } catch (e) {
    // 이메일 전송 실패해도 등록은 정상 처리
    Logger.log('Email send failed: ' + e.message);
  }

  return {
    success: true,
    message: '도서가 등록 요청되었습니다. 관리자 승인 후 게시됩니다.'
  };
}

function approveBook(id) {
  var pendingSheet = getOrCreateSheet(PENDING_SHEET);
  var booksSheet = getOrCreateSheet(BOOKS_SHEET);

  var data = pendingSheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('ID');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      var row = data[i].slice();
      // 등록일 → 승인일로 업데이트
      row[row.length - 1] = getTodayStr();
      booksSheet.appendRow(row);
      pendingSheet.deleteRow(i + 1);
      return { success: true, message: '도서가 승인되었습니다.' };
    }
  }

  return { success: false, error: '해당 도서를 찾을 수 없습니다.' };
}

function rejectBook(id) {
  var pendingSheet = getOrCreateSheet(PENDING_SHEET);
  var data = pendingSheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('ID');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      pendingSheet.deleteRow(i + 1);
      return { success: true, message: '도서가 반려되었습니다.' };
    }
  }

  return { success: false, error: '해당 도서를 찾을 수 없습니다.' };
}

function editBook(data) {
  var sheetName = data.sheet === 'pending' ? PENDING_SHEET : BOOKS_SHEET;
  var sheet = getOrCreateSheet(sheetName);
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var idCol = headers.indexOf('ID');

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(data.id)) {
      var rowNum = i + 1;
      var setCell = function(colName, value) {
        var col = headers.indexOf(colName);
        if (col >= 0) sheet.getRange(rowNum, col + 1).setValue(value);
      };
      setCell('도서명', data.title || '');
      setCell('부제', data.subtitle || '');
      setCell('저자', data.author || '');
      setCell('출판사', data.publisher || '');
      setCell('출판일', data.pubDate || '');
      setCell('ISBN', data.isbn || '');
      setCell('교보문고', data.linkKyobo || '');
      setCell('Yes24', data.linkYes24 || '');
      setCell('알라딘', data.linkAladin || '');
      setCell('기타', data.linkEtc || '');
      setCell('수준별', data.level || '');
      setCell('내용별', data.content || '');
      setCell('지정도서목록1', data.project1 || '');
      setCell('지정도서목록2', data.project2 || '');
      setCell('지정도서목록3', data.project3 || '');
      setCell('지정도서목록4', data.project4 || '');
      setCell('지정도서목록5', data.project5 || '');
      return { success: true, message: '도서 정보가 수정되었습니다.' };
    }
  }

  return { success: false, error: '해당 도서를 찾을 수 없습니다.' };
}

function deleteBook(id) {
  var booksSheet = getOrCreateSheet(BOOKS_SHEET);
  var trashSheet = getOrCreateSheet(TRASH_SHEET);
  var data = booksSheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('ID');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      var row = data[i].slice();
      row.push(getTodayStr()); // 삭제일 추가
      trashSheet.appendRow(row);
      booksSheet.deleteRow(i + 1);
      return { success: true, message: '도서가 휴지통으로 이동되었습니다.' };
    }
  }

  return { success: false, error: '해당 도서를 찾을 수 없습니다.' };
}

// ========== Viewership ==========

function addView() {
  var sheet = getOrCreateSheet(STATS_SHEET);
  var data = sheet.getDataRange().getValues();
  var today = getTodayStr();

  if (data.length < 2) {
    sheet.appendRow([today, 1, 1]);
    return { success: true, today: 1, total: 1 };
  }

  var lastRow = data.length;
  var lastDate = data[lastRow - 1][0];
  var lastDateStr = (lastDate instanceof Date)
    ? Utilities.formatDate(lastDate, 'Asia/Seoul', 'yyyy-MM-dd')
    : String(lastDate);

  var todayCount, totalCount;

  if (lastDateStr === today) {
    todayCount = Number(data[lastRow - 1][1]) + 1;
    totalCount = Number(data[lastRow - 1][2]) + 1;
    sheet.getRange(lastRow, 2).setValue(todayCount);
    sheet.getRange(lastRow, 3).setValue(totalCount);
  } else {
    totalCount = Number(data[lastRow - 1][2]) + 1;
    todayCount = 1;
    sheet.appendRow([today, todayCount, totalCount]);
  }

  return { success: true, today: todayCount, total: totalCount };
}

function getStats() {
  var sheet = getOrCreateSheet(STATS_SHEET);
  var data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return { success: true, today: 0, total: 0 };
  }

  var lastRow = data.length;
  var lastDate = data[lastRow - 1][0];
  var today = getTodayStr();
  var lastDateStr = (lastDate instanceof Date)
    ? Utilities.formatDate(lastDate, 'Asia/Seoul', 'yyyy-MM-dd')
    : String(lastDate);

  var todayCount = (lastDateStr === today) ? Number(data[lastRow - 1][1]) : 0;
  var totalCount = Number(data[lastRow - 1][2]);

  return { success: true, today: todayCount, total: totalCount };
}

// ========== Initial Setup ==========

/**
 * 최초 1회 실행하여 시트를 초기화합니다.
 * Apps Script 편집기에서 이 함수를 선택 후 [실행] 클릭
 */
function setup() {
  getOrCreateSheet(BOOKS_SHEET);
  getOrCreateSheet(PENDING_SHEET);
  getOrCreateSheet(TRASH_SHEET);
  getOrCreateSheet(STATS_SHEET);
  Logger.log('GeoShelf 시트 초기화 완료!');
}
