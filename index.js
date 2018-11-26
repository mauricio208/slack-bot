const path = require('path');
require('dotenv').config({path: path.join(__dirname, ".env")});
const FileSync = require('lowdb/adapters/FileSync')
const WebClient = require('@slack/client').WebClient;
const tz = require('timezone/loaded');
const schedule = require('node-schedule-tz');
const jataApi = require('./thirpAPI_integration')
const slackVerifier = require('./slack_request_verifier')
const express = require('express');
const rp = require('request-promise');
const moment = require('moment');

const app = express();
const bodyParser = require('body-parser');

const low = require('lowdb')
const adapter = new FileSync('db.json')
const db = low(adapter);

const port = process.env.SERVER_PORT
const token = process.env.SLACK_APP_TOKEN
const adminEmail = process.env.ADMIN_EMAIL
const adminPassword = process.env.ADMIN_PASS
const clientId = process.env.SLACK_CLIENT_ID
const clientSecret = process.env.SLACK_CLIENT_SECRET


db.defaults({'teams':[]}).write()

var web = new WebClient(token);
const botChannelId = 'ANYTHING123'
const botTeamId = 'ANYOTHER8731'
const ruleSetter = (ruleSetting) =>{
  var newRule = new schedule.RecurrenceRule();
  if (ruleSetting.second == 0 || ruleSetting.second){
    newRule.second=ruleSetting.second;
  }
  if (ruleSetting.minute == 0 || ruleSetting.minute){
    newRule.minute=ruleSetting.minute;
  }
  if (ruleSetting.hour == 0 || ruleSetting.hour){
    newRule.hour=ruleSetting.hour;
  }
  if (ruleSetting.date == 0 || ruleSetting.date){
    newRule.date=ruleSetting.date;
  }
  if (ruleSetting.month == 0 || ruleSetting.month){
    newRule.month=ruleSetting.month;
  }
  if (ruleSetting.year){
    newRule.year=ruleSetting.year;
  }
  if (ruleSetting.dayOfWeek == 0 || ruleSetting.dayOfWeek){
    newRule.dayOfWeek=ruleSetting.dayOfWeek;
  }
  if (ruleSetting.tz){
    newRule.tz=ruleSetting.tz;
  }
  return newRule;
}
const statTemplate = (stats, title) => {
  var formatedStats = Object.keys(stats)
                      .map(statname =>`${statname}: ${stats[statname]}`)
                      .slice(0,-1)
                      .join('\n');
  var actualTime = Math.floor((new Date()).getTime() / 1000)
  return [
   {
    "color": "#36a64f",
    "title": title,
    "text": formatedStats ? formatedStats: 'You have no data for this item',
    "fields":stats['total'] ?[
        {
            "title": `Total: ${stats['total']}`
        }
    ]:undefined,
    "ts": actualTime,
    }
  ];
}

const sendAttachment = (accessToken, channelid, attachments) =>{
  var webUserToken = new WebClient(accessToken);
  webUserToken.chat.postMessage({channel:channelid, attachments: attachments, as_user: false})
  .catch(err=>console.log('Error:', err));
}

var dailyStatsRule = ruleSetter({
  hour: 10,//[new schedule.Range(0, 23)]
  dayOfWeek: [new schedule.Range(1, 6)], 
  minute: 0,//[new schedule.Range(0, 60)],
  tz: 'Europe/Denmark'
})

var dailyReportSetterRule = ruleSetter({
  // hour:0,
  // dayOfWeek: [new schedule.Range(1, 6)],
  minute: [new schedule.Range(0, 60)]//0
})

const setUserReport = (team)=>{
  var today = new Date();
  var identifier = team.thirpAPIIdentifier
  var channelId = team.daily_stat.channel_id;
  var time = team.daily_stat.time.split(':');
  var tz = team.daily_stat.tz;
  var scheduleTime = moment().tz(tz);
  scheduleTime.hour(time[0]);
  scheduleTime.minute(time[1]);
  var setted = db.get('teams').filter({team_id:team.team_id}).value()[0].daily_stat.setted;
  if (!setted) {
    schedule.scheduleJob(scheduleTime.toDate(), ()=>{
      jataApi.getMacroUsageStats(identifier).then((usagestats)=>{
        jataApi.getTicketsStats(identifier).then((ticketsstats)=>{
          var stats = statTemplate(usagestats,'Macro usage')
            .concat(statTemplate(ticketsstats,'Tickets'));
          sendAttachment(team.access_token, channelId, stats);
          db.get('teams').filter({team_id:team.team_id}).value()[0].daily_stat.setted = false;
          db.write();
        })
      })
    })
    db.get('teams').filter({team_id:team.team_id}).value()[0].daily_stat.setted = true;
    db.write();
  }
}

function slackVerifyMiddleware(req, res, next) {
  if (slackVerifier(req)) {
   next();
  }else{
    next('route');
  }
}

schedule.scheduleJob(dailyReportSetterRule, () =>{
  var teams = db.get('teams').filter((team)=>{return team.daily_stat})
  for (const team of teams){
    setUserReport(team);    
  }
});
schedule.scheduleJob(dailyStatsRule, () => {
  jataApi.getMacroUsageStats().then((stats)=>{
    sendAttachment(token, botChannelId, statTemplate(stats,'Macro usage'));
  })
  .catch(err=>console.log(err))
});

app.use(bodyParser.urlencoded({ 
  extended: true,
  verify: function(req, res, buf, encoding) {    
    req.rawBody = buf.toString();
    }
  })
);
app.use(bodyParser.json());

app.post('/thirpAPIstats', slackVerifyMiddleware, (request, response) => {
  var slackData = request.body
  var teamId = slackData.team_id
  var delayedUri = slackData.response_url;
  var identifier = undefined;
  if (slackData.team_id != botTeamId) {
    var teamData = db.get('teams').find({ team_id: teamId }).value()
    identifier = teamData.thirpAPIIdentifier? teamData.thirpAPIIdentifier:undefined;
  }
  if ((slackData.team_id != botTeamId) && !identifier) {
    response.send(`BAD INSTALLATION`)
  } else {
    if(slackData.text === '' || slackData.text === 'tickets' || slackData.text === 'usage'){
      response.send(`I'm collecting your data, just a moment please :timer_clock:`);
    }else{
      response.send(`I didn't understand that, maybe you can try /thirpAPIhelp to have some guidance`);
    }
    if (slackData.text === '') {
      jataApi.getMacroUsageStats(identifier).then((usagestats)=>{
        jataApi.getTicketsStats(identifier).then((ticketsstats)=>{
          var stats = statTemplate(usagestats,'Macro usage')
            .concat(statTemplate(ticketsstats,'Tickets'));
          rp({
            uri:delayedUri,
            method:'POST',
            body:{
              "response_type": "in_channel",
              "attachments":stats
            },
            json:true,
          })
        })
      })
    }
    if (slackData.text === 'usage') {
      jataApi.getMacroUsageStats(identifier).then((stats)=>{
        var stats = statTemplate(stats,'Macro usage');
        rp({
          uri:delayedUri,
          method:'POST',
          body:{
            "response_type": "in_channel",
            "attachments":stats
          },
          json:true,
        })
      })
    }
    if (slackData.text === 'tickets') {
      jataApi.getTicketsStats(identifier).then((stats)=>{
        var stats = statTemplate(stats,'Tickets');
        rp({
          uri:delayedUri,
          method:'POST',
          body:{
            "response_type": "in_channel",
            "attachments":stats
          },
          json:true,
        })
      })
    }  
    
  }
})

app.get('/thirpAPIslackinstall/:user_jid', (request, response) => {
  var code = request.query.code;
  var userthirpAPIId = request.params.user_jid;
  var getAccessTokenOption = {
    uri: 'https://slack.com/api/oauth.access',
    qs:{
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri:`https://myhost.thirpAPI.com/slackbot/thirpAPIslackinstall/${userthirpAPIId}`, 
    },
    method:'GET',
    headers: {
        'User-Agent': 'Request-Promise'
    },
    json: true
  }
  rp(getAccessTokenOption).then(installationData=>{
    if(!installationData.ok){
      response.send(`The installation process was not completed, it ended with this error:\n${installationData.error}`);
      return 0;
    }
    db.get('teams')
      .remove({ team_id: installationData.team_id })
      .write()
    installationData['thirpAPIIdentifier']=userthirpAPIId;
    db.get('teams')
      .push(installationData)
      .write()

    var integrationData  = {
        "identifier": installationData.thirpAPIIdentifier,
        "access_token":installationData.access_token,
        "scope":installationData.scope,
        "user_id":installationData.user_id,
        "team_name":installationData.team_name,
        "team_id":installationData.team_id,
        "bot_user_id":installationData.bot? installationData.bot.bot_user_id:'BOT_NOT_SETTED',
        "bot_access_token":installationData.bot? installationData.bot.bot_access_token:'BOT_NOT_SETTED',
        "thirpAPIIdentifier":installationData.thirpAPIIdentifier,
        "channel_id":"REPORT_NOT_SETTED",
        "time":"REPORT_NOT_SETTED",
        "tz":"REPORT_NOT_SETTED"
    }
    jataApi.integrate(integrationData).then(res=>{
      response.status(301).redirect("http://help.thirpAPI.com/thirpAPI-for-slack/introduction-to-thirpAPI-for-slack")
    }).catch(error=>{
      console.error(error);
      response.status(500).send(`Error during installation, the app may work but the installation finished with errors, please contact our support team with this information:\n${JSON.stringify(error)}`);
    })
  }).catch(error=>{
    console.error(error);
    response.status(500).send(`Error during installation, the app may work but the installation finished with errors, please contact our support team with this information:\n${JSON.stringify(error)}`);
  })
});

app.post('/thirpAPIhelp', slackVerifyMiddleware, (request, response) => {
  // var redirectUri = response.request.uri.href;
  let helpMessage = {
    "text": "If you need help go to http://help.thirpAPI.com/ or write us directly to our support email support@thirpAPI.com",
    "attachments": [
        {
            "title": "Slash commands usage",
            "title_link": "http://help.thirpAPI.com/thirpAPI-for-slack/introduction-to-thirpAPI-for-slack",
			"fields": [
                {
					"title": "/thirpAPIstats",
					"value": "Show Macro usage and tickets data from your thirpAPI account",
					"short": true
				},
				{
					"title": "/thirpAPIstats usage",
					"value": "Show Macro usage from your thirpAPI account",
					"short": true
				},
				{
					"title": "/thirpAPIstats tickets",
					"value": "Show tickets data from your thirpAPI account",
					"short": true
				},
				{
					"title": "/thirpAPIsetreport HH:MM",
					"value": "24-hour format, HH been hours and MM been minutes) Show a daily report of macro usage and ticket data on the channel where the command was issued on the specified hour",
					"short": true
				}
            ]
        }
    ]
  };
  response.setHeader('Content-Type', 'application/json');
  response.send(JSON.stringify(helpMessage));

});

app.post('/thirpAPIsetreport', slackVerifyMiddleware, (request, response) => {
  var slackData = request.body;
  var teamId = slackData.team_id;
  var userId = slackData.user_id;
  var channelId = slackData.channel_id;
  var identifier = undefined;
  if(slackData.text === 'stop'){
    db.get('teams').find({ team_id: teamId}).unset('daily_stat').write();
    response.send('To activate the report again use /thirpAPIsetreport HH:MM on any channel')
    return 0;
  }

  if(!slackData.text){
    response.send(`The correct format is : /thirpAPIsetreport HH:MM , where HH:MM is the time expressed on a 24 hour format`);
    return 0;
  }
  var reportTime = slackData.text.split(':');
  if(Number(reportTime[0])<0 || Number(reportTime[0])>23 || Number(reportTime[1])<0 || Number(reportTime[1])>59){
    response.send(`Daily report activation failed, remember the time is in 24 hour format (HH:MM)`);
    return 0;
  }

  if (slackData.team_id != botTeamId) {
    var teamData = db.get('teams').find({ team_id: teamId }).value()
    identifier = teamData.thirpAPIIdentifier? teamData.thirpAPIIdentifier:undefined;
  }

  if ((slackData.team_id != botTeamId) && !identifier) {
    response.send(`BAD INSTALLATION`)
  } else {
    response.send(`I will report your stats at ${slackData.text} every day on this channel, if you want me to stop just write '/thirpAPIsetreport stop'`)
    var webUserToken = new WebClient(teamData.access_token);
    webUserToken.users.info({'user':userId}).then(infoResponse=>{
      var tz = infoResponse.user.tz;
      db.get('teams')
        .find({ team_id: teamId })
        .assign({"daily_stat":{"channel_id":channelId,"time":slackData.text, "tz":tz}})
        .write()
    })
    .catch(error=>console.error(error));
  }


})

app.listen(port, (err) => {
  if (err) {
    return console.error('ERROR:', err)
  }
  console.log(`server is listening on ${port}`)
})