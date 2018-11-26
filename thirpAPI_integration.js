var rp = require('request-promise');
const macroUssageUri = 'https://myhost.thirpAPI.com/analytics_all';
const ticketsUri = 'https://myhost.thirpAPI.com/analytics_t';
const logInUri = 'https://app.thirpAPI.com/login'
const slackIntegrateUri = 'https://app.thirpAPI.com/slack_integrate'


var statOptions = (uri, qs, method, body) =>{
  return {
  uri: uri,
  qs: qs,
  body: body,
  method:method? method:'GET',
  headers: {
      'User-Agent': 'Request-Promise'
  },
  json: true
  }
};
var integrateOptions = (uri, body) =>{
  return {
  uri: uri,
  body: body,
  method:'POST',
  headers: {
      'User-Agent': 'Request-Promise',
      'Content-Type': 'application/json'
  },
  json: true
  }
};
module.exports = {
  getMacroUsageStats : (user) => {
    var qs={}
    if (user) {
      qs={identifier:user};
    }
    var options = statOptions(macroUssageUri, qs)
    return rp(options)    
  },
  getTicketsStats : (user) => {
    var qs={}
    if (user) {
      qs={identifier:user};
    }
    var options = statOptions(ticketsUri, qs)
    return rp(options)     
  },
  logIn: (email, password) =>{
    qs={email:email, password:password};
    var options = statOptions(logInUri, undefined, 'POST', qs)
    return rp(options)
  },
  integrate: (data)=>{
    var options = integrateOptions(slackIntegrateUri,data)
    return rp(options)
  }
}