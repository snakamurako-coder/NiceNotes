/**
 * Entry: legacy PDF/HTML UI + Tasks JSON API (GitHub Pages / fetch).
 */

/**
 * @param {Object} [e]
 * @returns {GoogleAppsScript.HTML.HtmlOutput|GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  var mode = e && e.parameter && e.parameter.mode;
  if (mode === 'tasks') {
    return handleTasksGet_();
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
    )
    .setTitle('Universal Document Workspace');
}

/**
 * @param {Object} e
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOutput_({
      ok: false,
      error: 'VALIDATION',
      message: 'Invalid JSON body',
    });
  }
  return handleTasksPost_(body);
}

function getFileList(mode) {
  try {
    var props = PropertiesService.getScriptProperties();
    var folderId =
      mode === 'single'
        ? props.getProperty('SINGLE_FOLDER_ID')
        : props.getProperty('SEAMLESS_FOLDER_ID');

    if (!folderId)
      return {
        error: 'プロパティに ' + mode + ' フォルダのIDがありません。',
      };

    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var list = [];

    while (files.hasNext()) {
      var file = files.next();
      var mime = file.getMimeType();
      if (
        mime === MimeType.PDF ||
        mime === MimeType.JPEG ||
        mime === MimeType.PNG
      ) {
        list.push({ id: file.getId(), name: file.getName() });
      }
    }
    return list;
  } catch (err) {
    return { error: err.toString() };
  }
}

function getFileData(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    return Utilities.base64Encode(file.getBlob().getBytes());
  } catch (err) {
    return { error: err.toString() };
  }
}

function saveAnnotation(fileName, jsonData) {
  try {
    var folder = DriveApp.getRootFolder();
    var targetName = fileName + '_rev.json';
    var files = folder.getFilesByName(targetName);
    if (files.hasNext()) {
      files.next().setContent(jsonData);
    } else {
      folder.createFile(targetName, jsonData, MimeType.PLAIN_TEXT);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function loadAnnotation(fileName) {
  try {
    var files = DriveApp.getRootFolder().getFilesByName(fileName + '_rev.json');
    if (files.hasNext())
      return { success: true, data: files.next().getBlob().getDataAsString() };
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function recognizeSentence(allStrokes) {
  var url =
    'https://www.google.com.hk/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8';
  var payload = {
    options: 'enable_pre_space',
    requests: [
      {
        writing_guide: { writing_area_width: 1000, writing_area_height: 1000 },
        ink: allStrokes,
        language: 'ja',
      },
    ],
  };

  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
    });
    var result = JSON.parse(response.getContentText());
    if (result[0] === 'SUCCESS') {
      return result[1][0][1][0];
    }
  } catch (err) {
    return '認識エラー';
  }
}
