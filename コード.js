function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setTitle('Universal Document Workspace');
}

function getFileList(mode) {
  try {
    const props = PropertiesService.getScriptProperties();
    let folderId = mode === 'single' ? props.getProperty('SINGLE_FOLDER_ID') : props.getProperty('SEAMLESS_FOLDER_ID');
    
    if (!folderId) return { error: `プロパティに ${mode} フォルダのIDがありません。` };

    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const list = [];
    
    while (files.hasNext()) {
      const file = files.next();
      const mime = file.getMimeType();
      if (mime === MimeType.PDF || mime === MimeType.JPEG || mime === MimeType.PNG) {
        list.push({ id: file.getId(), name: file.getName() });
      }
    }
    return list;
  } catch (e) {
    return { error: e.toString() };
  }
}

function getFileData(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    return Utilities.base64Encode(file.getBlob().getBytes());
  } catch (e) {
    return { error: e.toString() };
  }
}

function saveAnnotation(fileName, jsonData) {
  try {
    const folder = DriveApp.getRootFolder();
    const targetName = fileName + '_rev.json';
    const files = folder.getFilesByName(targetName);
    if (files.hasNext()) {
      files.next().setContent(jsonData); 
    } else {
      folder.createFile(targetName, jsonData, MimeType.PLAIN_TEXT); 
    }
    return { success: true };
  } catch (e) { return { success: false, error: e.toString() }; }
}

function loadAnnotation(fileName) {
  try {
    const files = DriveApp.getRootFolder().getFilesByName(fileName + '_rev.json');
    if (files.hasNext()) return { success: true, data: files.next().getBlob().getDataAsString() };
    return { success: true, data: null };
  } catch (e) { return { success: false, error: e.toString() }; }
}

// 【新規追加】ストローク配列を受け取りGoogle APIへ送る関数
function recognizeSentence(allStrokes) {
  const url = "https://www.google.com.hk/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8";
  const payload = {
    "options": "enable_pre_space",
    "requests": [{
      "writing_guide": { "writing_area_width": 1000, "writing_area_height": 1000 },
      "ink": allStrokes,
      "language": "ja"
    }]
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload)
    });
    const result = JSON.parse(response.getContentText());
    if (result[0] === "SUCCESS") {
      return result[1][0][1][0];
    }
  } catch (e) {
    return "認識エラー";
  }
}