'use strict';
const AWS = require('aws-sdk');

module.exports.getAccountData = async event => {
  console.log({ log: 'getAccountData.input', ...event});

  if (event === undefined) throw new Error('event must not be undefined');
  if (event.accountId === undefined) throw new Error('event.accountId must not be undefined');

  const org = new AWS.Organizations();
  const response = await org.describeAccount({AccountId: event.accountId}).promise();

  console.log({ log: 'getAccountData.response', ...response});

  if (response.Account === undefined) throw new Error('unable to retrieve account');
  return response.Account;
};


module.exports.sendEmail = async event => {
  console.log({ log: 'sendEmail.input', ...event});

  if (event === undefined) throw new Error('event must not be undefined');
  if (event.contentTemplateName === undefined) throw new Error('event.contentTemplateName must not be undefined');
  if (event.contentTemplateData === undefined) throw new Error('event.contentTemplateData must not be undefined');
  if (event.toAddress === undefined) throw new Error('event.toAddress must not be undefined');

  const ses = new AWS.SES();
  const request = {
    Destination: {
      ToAddresses: [
        event.toAddress
      ]
    },
    Source: process.env.fromEmailAddress,
    Template: event.contentTemplateName,
    TemplateData: JSON.stringify(event.contentTemplateData)
  };

  console.log({ log: 'sendEmail.request', ...request});
  const response = await ses.sendTemplatedEmail(request).promise();

  console.log({ log: 'sendEmail.response', ...response});
  return response;
};
