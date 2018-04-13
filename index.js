'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
  signatureVersion: 'v4',
});
const Sharp = require('sharp');

const BUCKET_FROM = process.env.BUCKET_FROM;
const BUCKET_TO = process.env.BUCKET_TO;
const URL = process.env.URL;
const ALLOWED_DIMENSIONS = new Set();

if (process.env.ALLOWED_DIMENSIONS) {
  const dimensions = process.env.ALLOWED_DIMENSIONS.split(/\s*,\s*/);
  dimensions.forEach((dimension) => ALLOWED_DIMENSIONS.add(dimension));
}

exports.handler = function(event, context, callback) {
  const key = event.queryStringParameters.key;
  const match = key.match(/((\d+)x(\d+))\/(.*)/);
  const dimensions = match[1];
  const width = parseInt(match[2], 10);
  const height = parseInt(match[3], 10);
  const originalKey = match[4];

  const matchExt = originalKey.match(/[^\.]([0-9a-z]+)(?=[?#])|[^\.](?:[\w]+)$/gmi)
  const ext = matchExt[0]

  if(ALLOWED_DIMENSIONS.size > 0 && !ALLOWED_DIMENSIONS.has(dimensions)) {
     callback(null, {
      statusCode: '403',
      headers: {},
      body: '',
    });
    return;
  }

  S3.getObject({Bucket: BUCKET_FROM, Key: originalKey}).promise()
    .then(data => Sharp(data.Body)
      .resize(width, height)
      .max()
      .toBuffer()
    )
    .then(buffer => S3.putObject({
        Body: buffer,
        Bucket: BUCKET_TO,
        ContentType: 'image/' + ext,
        Key: key,
      }).promise()
    )
    .then(() => callback(null, {
        statusCode: '301',
        headers: {'location': `${URL}/${key}`},
        body: '',
      })
    )
    .catch(err => callback(err))
}
