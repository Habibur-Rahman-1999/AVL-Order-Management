// ১. ওটিপি রিকোয়েস্ট রিসিভ করার মেইন ফাংশন
function doPost(e) {
  try {
    var requestData = JSON.parse(e.postData.contents);
    var toEmail = requestData.to_email;
    var toName = requestData.to_name || "ইউজার";
    var otpCode = requestData.otp_code;
    var type = requestData.type || "REGISTRATION"; // REGISTRATION অথবা PASSWORD_RESET
    
    var accessToken = getMicrosoftAccessToken();
    
    var subject = "AVL System - ইমেইল ভেরিফিকেশন কোড";
    var messageText = "আপনার অ্যাকাউন্টটি ভেরিফাই করার জন্য ওটিপি (OTP) কোডটি নিচে দেওয়া হলো:";
    
    if (type === "PASSWORD_RESET") {
      subject = "AVL System - পাসওয়ার্ড রিসেট ওটিপি";
      messageText = "আপনার পাসওয়ার্ডটি রিসেট করার জন্য নিচের ওটিপি (OTP) কোডটি ব্যবহার করুন:";
    }
    
    var apiResponse = sendCustomGraphEmail(accessToken, toEmail, toName, otpCode, subject, messageText);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", log: apiResponse }))
                         .setMimeType(ContentService.MimeType.JSON);
                         
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// ২. রিফ্রেশ টোকেন দিয়ে নতুন অ্যাক্সেস টোকেন জেনারেট করার ফাংশন
function getMicrosoftAccessToken() {
  var props = PropertiesService.getScriptProperties();
  
  var clientId = props.getProperty('CLIENT_ID');
  var clientSecret = props.getProperty('CLIENT_SECRET');
  var refreshToken = props.getProperty('REFRESH_TOKEN');
  var tenantId = props.getProperty('TENANT_ID') || 'common';

  var tokenUrl = 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token';
  
  var payload = {
    'client_id': clientId,
    'client_secret': clientSecret,
    'refresh_token': refreshToken,
    'grant_type': 'refresh_token',
    'scope': 'https://graph.microsoft.com/.default'
  };

  var options = {
    'method': 'post',
    'payload': payload,
    'muteHttpExceptions': true
  };

  var response = UrlFetchApp.fetch(tokenUrl, options);
  var json = JSON.parse(response.getContentText());

  if (json.access_token) {
    if (json.refresh_token && json.refresh_token !== refreshToken) {
      props.setProperty('REFRESH_TOKEN', json.refresh_token);
    }
    return json.access_token;
  } else {
    throw new Error('Microsoft Token Refresh Failed: ' + response.getContentText());
  }
}

// ৩. Microsoft Graph API /sendMail ফাংশন
function sendCustomGraphEmail(accessToken, toEmail, toName, otpCode, subject, messageText) {
  var url = 'https://graph.microsoft.com/v1.0/me/sendMail';
  
  var htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;'>" +
                    "<h2 style='color: #1e3c72; text-align: center;'>AVL Order Management</h2>" +
                    "<p>প্রিয় <strong>" + toName + "</strong>,</p>" +
                    "<p>" + messageText + "</p>" +
                    "<div style='background: #f1f5f9; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px; color: #e53e3e; border-radius: 8px; margin: 20px 0;'>" + otpCode + "</div>" +
                    "<p style='font-size: 12px; color: #64748b;'>এটি একটি স্বয়ংক্রিয় ইমেল, দয়া করে উত্তর দেবেন না। এই কোডটি ৫ মিনিটের জন্য কার্যকর থাকবে।</p>" +
                    "</div>";

  var emailPayload = {
    "message": {
      "subject": subject,
      "body": {
        "contentType": "HTML",
        "content": htmlContent
      },
      "toRecipients": [
        {
          "emailAddress": {
            "address": toEmail
          }
        }
      ]
    },
    "saveToSentItems": "true"
  };

  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'Authorization': 'Bearer ' + accessToken
    },
    'payload': JSON.stringify(emailPayload),
    'muteHttpExceptions': true
  };

  var response = UrlFetchApp.fetch(url, options);
  return response.getContentText();
}