// Container for frontend application
var app = {};

// Config
app.config = {
  'sessionToken': false
};

// AJAX Client (for RESTful API)
app.client = {}

// Interface for making API calls
app.client.request = function (headers, path, method, queryStringObject, payload, callback) {

  // Set defaults
  headers = typeof (headers) == 'object' && headers !== null ? headers : {};
  path = typeof (path) == 'string' ? path : '/';
  method = typeof (method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE'].indexOf(method.toUpperCase()) > -1 ? method.toUpperCase() : 'GET';
  queryStringObject = typeof (queryStringObject) == 'object' && queryStringObject !== null ? queryStringObject : {};
  payload = (typeof (payload) == 'object' || typeof (payload) == 'string' || typeof (payload) == 'number' && payload !== null) ? payload : {};
  callback = typeof (callback) == 'function' ? callback : false;

  // For each query string parameter sent, add it to the path
  var requestUrl = path + '?';
  var counter = 0;
  for (var queryKey in queryStringObject) {
    if (queryStringObject.hasOwnProperty(queryKey)) {
      counter++;
      // If at least one query string parameter has already been added, preprend new ones with an ampersand
      if (counter > 1) {
        requestUrl += '&';
      }
      // Add the key and value
      requestUrl += queryKey + '=' + queryStringObject[queryKey];
    }
  }

  // Form the http request as a JSON type
  var xhr = new XMLHttpRequest();
  xhr.open(method, requestUrl, true);
  xhr.setRequestHeader("Content-type", "application/json");

  // For each header sent, add it to the request
  for (var headerKey in headers) {
    if (headers.hasOwnProperty(headerKey)) {
      xhr.setRequestHeader(headerKey, headers[headerKey]);
    }
  }

  // If there is a current session token set, add that as a header
  if (app.config.sessionToken) {
    xhr.setRequestHeader("token", app.config.sessionToken.token);
  }

  // When the request comes back, handle the response
  xhr.onreadystatechange = function () {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      var statusCode = xhr.status;
      var responseReturned = xhr.responseText;

      // Callback if requested
      if (callback) {
        try {
          var parsedResponse = JSON.parse(responseReturned);
          callback(statusCode, parsedResponse);
        } catch (e) {
          callback(statusCode, false);
        }

      }
    }
  }

  // Send the payload as JSON
  var payloadString = JSON.stringify(payload);
  xhr.send(payloadString);

};

// Bind the logout button
app.bindLogoutButton = function () {
  document.getElementById("logoutButton").addEventListener("click", function (e) {
    e.preventDefault();
    app.logUserOut();
  });
};

// Log the user out then redirect them
app.logUserOut = function () {
  var tokenId = typeof (app.config.sessionToken.token) == 'string' ? app.config.sessionToken.token : false;
  var queryStringObject = {'token': tokenId};
  app.client.request(undefined, 'api/tokens', 'DELETE', queryStringObject, undefined, function (statusCode, responsePayload) {
    app.setSessionToken(false);
  });
};

app.bindForm = function (form) {

  form.addEventListener("submit", function (e) {

    // Stop it from submitting
    e.preventDefault();
    var formId = this.id;
    var path = this.action;
    var method = this.method.toUpperCase();

    if (document.querySelector("#" + formId + " .formError")) {
      document.querySelector("#" + formId + " .formError").style.display = 'none';
    }

    if (document.querySelector("#" + formId + " .formSuccess")) {
      document.querySelector("#" + formId + " .formSuccess").style.display = 'none';
    }


    // Turn the inputs into a payload
    var payload = {};
    var elements = this.elements;
    for (var i = 0; i < elements.length; i++) {
      if (elements[i].type !== 'submit') {
        // Determine class of element and set value accordingly
        var classOfElement = typeof (elements[i].classList.value) == 'string' && elements[i].classList.value.length > 0 ? elements[i].classList.value : '';
        var valueOfElement = elements[i].type == 'checkbox' && classOfElement.indexOf('multiselect') == -1 ? elements[i].checked : classOfElement.indexOf('intval') == -1 ? elements[i].value : parseInt(elements[i].value);
        var elementIsChecked = elements[i].checked;
        // Override the method of the form if the input's name is _method
        var nameOfElement = elements[i].name;
        if (nameOfElement == '_method') {
          method = valueOfElement;
        } else {
          // Create an payload field named "method" if the elements name is actually httpmethod
          if (nameOfElement == 'httpmethod') {
            nameOfElement = 'method';
          }
          // Create an payload field named "id" if the elements name is actually uid
          if (nameOfElement == 'uid') {
            nameOfElement = 'id';
          }
          // If the element has the class "multiselect" add its value(s) as array elements
          if (classOfElement.indexOf('multiselect') > -1) {
            if (elementIsChecked) {
              payload[nameOfElement] = typeof (payload[nameOfElement]) == 'object' && payload[nameOfElement] instanceof Array ? payload[nameOfElement] : [];
              payload[nameOfElement].push(valueOfElement);
            }
          } else {
            payload[nameOfElement] = valueOfElement;
          }

        }
      }
    }

    // If the method is DELETE, the payload should be a queryStringObject instead
    var queryStringObject = method == 'DELETE' ? payload : {};

    if (formId == 'sessionCreate') {
      queryStringObject = {userId: payload.userId};
      delete payload.userId;
    }
    else if (formId.startsWith('menuItem_') || formId.startsWith('removeItem_')) {
      payload = formId.replace('menuItem_', '').replace('removeItem_', '');
    }

    // Call the API
    app.client.request(undefined, path, method, queryStringObject, payload, function (statusCode, responsePayload) {
      console.log(statusCode, responsePayload);
      if (statusCode !== 200 && statusCode != 201) {
        if (statusCode == 403) {
          app.logUserOut();
        } else {
          var error = typeof (responsePayload.Error) == 'string' ? responsePayload.Error : 'An error has occured, please try again';
          document.querySelector("#" + formId + " .formError").innerHTML = error;
          document.querySelector("#" + formId + " .formError").style.display = 'block';
        }
      } else {
        app.formResponseProcessor(formId, payload, responsePayload);
      }

    });
  })
}

// Bind the forms
app.bindForms = function () {
  if (document.querySelector("form")) {

    var allForms = document.querySelectorAll("form");
    for (var i = 0; i < allForms.length; i++) {
      app.bindForm(allForms[i]);
    }
  };
}

// Form response processor
app.formResponseProcessor = function (formId, requestPayload, responsePayload) {
  var functionToCall = false;
  if (formId == 'accountCreate') {
    var newPayload = {
      'password': requestPayload.password
    };

    app.client.request(undefined, 'api/tokens', 'POST', {userId: responsePayload}, newPayload, function (newStatusCode, newResponsePayload) {
      // Display an error on the form if needed
      if (newStatusCode !== 200) {
        document.querySelector("#" + formId + " .formError").innerHTML = 'Sorry, an error has occured. Please try again.';
        document.querySelector("#" + formId + " .formError").style.display = 'block';
      } else {
        document.querySelector('#welcomeBox').innerHTML = 'Your user id is ' + responsePayload + ', please write it down to login in the future.';
        app.setSessionToken(newResponsePayload);
      }
    });
  }
  // If login was successful, set the token in localstorage and redirect the user
  if (formId == 'sessionCreate') {
    document.querySelector('#welcomeBox').innerHTML = 'Welcome, your logged in with user id ' + responsePayload.userId;
    app.setSessionToken(responsePayload);
  }

  if (formId.startsWith('menuItem_') || formId.startsWith('removeItem_')) {
    app.updateCart();
  }

  // If forms saved successfully and they have success messages, show them
  var formsWithSuccessMessages = ['accountEdit1', 'accountEdit2', 'checksEdit1'];
  if (formsWithSuccessMessages.indexOf(formId) > -1) {
    document.querySelector("#" + formId + " .formSuccess").style.display = 'block';
  }

};

app.updateCart = function (){
  app.client.request(undefined, 'api/cart', 'GET', undefined, undefined, function (newStatusCode, cartItemsIds) {
    // Display an error on the form if needed
    if (newStatusCode !== 200) {
      document.querySelector("#cart .formError").innerHTML = 'Sorry, an error has occured. The cart content may be stale.';
      document.querySelector("#cart .formError").style.display = 'block';
    } else {

      if (cartItemsIds.length > 0) {
        const cartWithCounts = cartItemsIds.reduce((acc, id) => {
          if (acc[id]) acc[id]++;
          else acc[id] = 1;
          return acc;
        }, {});

        const headerHtml = '<table><thead><tr><th>Product</th><th>Qty</th><th> </th></thead><tbody><tr>';
        const footerHtml = '</tr></tbody></table>';
        const cartHtml = Object.entries(cartWithCounts).map(([itemId, count]) => '<td>' + document.querySelector(`#menuItemName_${itemId}`).innerHTML + `</td><td>${count}</td><td><form action="api/cart" id="removeItem_${itemId}" method="POST"><input type="hidden" name="_method" value="DELETE"/><button type="submit" class="cta red" style="width: 50px;">X</button></form></td>`).join('</`tr><tr>');
        document.querySelector("#cartContent").innerHTML = headerHtml + cartHtml + footerHtml;
        Object.entries(cartWithCounts).forEach(([itemId, count]) => {
          app.bindForm(document.querySelector(`#removeItem_${itemId}`));
        });
      }
      else document.querySelector("#cartContent").innerHTML = "<p>Cart is empty!</p>";
    }

  });
}

// Get the session token from localstorage and set it in the app.config object
app.getSessionToken = function () {
  var tokenString = localStorage.getItem('token');
  if (typeof (tokenString) == 'string') {
    try {
      var token = JSON.parse(tokenString);
      app.config.sessionToken = token;
      if (typeof (token) == 'object') {
        app.setLoggedInClass(true);
      } else {
        app.setLoggedInClass(false);
      }
    } catch (e) {
      app.config.sessionToken = false;
      app.setLoggedInClass(false);
    }
  }
};

// Set (or remove) the loggedIn class from the body
app.setLoggedInClass = function (add) {
  var target = document.querySelector("body");
  if (add) {
    target.classList.add('loggedIn');
    app.updateCart();
  } else {
    target.classList.remove('loggedIn');
  }
};

// Set the session token in the app.config object as well as localstorage
app.setSessionToken = function (token) {
  app.config.sessionToken = token;
  var tokenString = JSON.stringify(token);
  localStorage.setItem('token', tokenString);
  if (typeof (token) == 'object') {
    app.setLoggedInClass(true);
  } else {
    app.setLoggedInClass(false);
  }
};

// Renew the token
app.renewToken = function (callback) {
  var currentToken = typeof (app.config.sessionToken) == 'object' ? app.config.sessionToken : false;
  if (currentToken) {
    app.client.request(undefined, 'api/tokens', 'PUT', {token: currentToken.token}, undefined, function (statusCode, responsePayload) {
      // Display an error on the form if needed
      if (statusCode == 200) {
        app.setSessionToken(responsePayload);
        callback(false);
      } else {
        app.setSessionToken(false);
        callback(true);
      }
    }
    );
  }
};

app.tokenRenewalLoop = function () {
  setInterval(function () {
    app.renewToken(function (err) {
      if (!err) {
        console.log("Token renewed successfully @ " + Date.now());
      }
    });
  }, 1000 * 60);
};

app.init = function () {
  app.bindForms();
  app.bindLogoutButton();
  app.getSessionToken();
  app.tokenRenewalLoop();
};

// // Call the init processes after the window loads
window.onload = function () {
  app.init();
};
