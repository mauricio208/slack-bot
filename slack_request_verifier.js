const crypto = require('crypto');
const verificationToken = process.env.SLACK_VERIFICATION_TOKEN

function verify(request){
    let body = request.rawBody
    let timestamp = request.get('X-Slack-Request-Timestamp')
    if (Math.abs(Date.now()/1000 - timestamp) > 60 * 5){
        return false;
    };
    let sigBasestring = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac('sha256', verificationToken);
    hmac.update(sigBasestring);
    let signature = 'v0=' + hmac.digest('hex');
    let slackSignature = request.get('X-Slack-Signature');
    return signature === slackSignature;
}

module.exports = verify;
