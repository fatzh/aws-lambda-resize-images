# AWS Lambda

## Image resize

Instructions based on [this tutorial](https://aws.amazon.com/blogs/compute/resize-images-on-the-fly-with-amazon-s3-aws-lambda-and-amazon-api-gateway/)

The code is [here](https://github.com/awslabs/serverless-image-resizing)

So... the goal is to have an URL that reads images from a private bucket, resize and writes to a public bucket.

### The public destination bucket

This will host the transformed images. I call it `mybucket-public--prod`. Then configure the Bucket policy, and use the following policy to grant read access (*s3:GetObject*) :

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AddPerm",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::mybucket-public--prod/*"
        }
    ]
}
```

A list of all S3 action can be found [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/list_s3.html).

Setup a static website in the bukcet properties pane. Set the index document to `index.html`, the file doesn't have to exist as the website will only be used to serve the existing images.

Note the website URL, for me: `http://mybucket-public--prod.s3-website.eu-central-1.amazonaws.com`

I upload an image (`test.jpg`) there for testing, check that you can open the image via the above URL: `http://mybucket-public--prod.s3-website.eu-central-1.amazonaws.com/test.jpg`.

### The lambda function

In the S3 console, go to *Lambda* and *Create new function* then *Author from scratch*.

Name: `resize`  
Runtime: `Node.js 6.10`  *May be worth testing with the lastest verison of node...*  
Role: `Create a custom role`  

This will open a new window to configure the custom role, in the *policy document* click *edit* (and *ok*). This is the policy to allow the new role to read from the private bucket (this requires additional permissions like *List*...) and put objects in the public bucket.

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": [
                "arn:aws:s3:::mybucket-public--prod/*",
                "arn:aws:logs:*:*:*"
            ]
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::mybucket--prod",
                "arn:aws:s3:::mybucket--prod/*"
            ]
        },
        {
            "Sid": "VisualEditor2",
            "Effect": "Allow",
            "Action": [
                "s3:ListAllMyBuckets",
                "s3:HeadBucket",
                "s3:ListObjects"
            ],
            "Resource": "*"
        },
        {
            "Sid": "VisualEditor3",
            "Effect": "Allow",
            "Action": "logs:CreateLogGroup",
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

And click on *Create function*.

Now you can upload the lambda function code (.zip file). I use the compiled version from this [repo](https://github.com/awslabs/serverless-image-resizing) but I modified the function to resize the image to fit the dimensions (no cropping). It's rather simple, download the .zip file, uncompress, edit the `index.js` file in it and recompress. **Attention: the zip file must contain the files, not the directory! i.e. index.js must be at the root of the archive**

I modified it a bit:  
* the resize part to add a call to `max()` as described in the [library doc](http://sharp.pixelplumbing.com/en/stable/api-resize/#max).  
* I want to read from a bucket and write in another, so I changed the `BUCKET` environment variable to be `BUCKET_FROM` and `BUCKET_TO`.  
* Don't change the image format

The function requires a few environment variables to run, they can be configured below. `URL` is the full url of the public website configured on the S3 public bucket toredirect to once the image has been generated.

```
BUCKET_FROM: mybucket--prod
BUCKET_TO: mybucket-public--prod
URL: http://mybucket-public--prod.s3-website.eu-central-1.amazonaws.com
```
Optionnaly, you can also limit the allowed dimensions:

```
ALLOWED_DIMENSIONS: 400x400,1200x1200
```

Set the memory and timeout parameters. I used the recommended values `1536` and `10 sec`.

### The API endpoint

Now we need an endpoint to trigger the lambda function, in the lamdba configuration panel, add a trigger `API Gateway`. Choose *Create new API* and name it *resize*. The deployment stage is basically `stage` or `prod`. Security should be *Open*.

Save and you can see the URL of you API endpoint, for me it's `https://<random_stuff>.execute-api.eu-central-1.amazonaws.com/prod/resize`.

### Redirect missing image to API endpoint

The last thing to do is to configure the bucket to execute the lambda function if the file is not found. To do this, edit the S3 Bucket website configuration, and edit the redirection rule to add this (note the hostname and API name in the configuration):

```
<RoutingRules>
    <RoutingRule>
        <Condition>
            <KeyPrefixEquals/>
            <HttpErrorCodeReturnedEquals>404</HttpErrorCodeReturnedEquals>
        </Condition>
        <Redirect>
            <Protocol>https</Protocol>
            <HostName><random_stuff>.execute-api.eu-central-1.amazonaws.com</HostName>
            <ReplaceKeyPrefixWith>prod/resize?key=</ReplaceKeyPrefixWith>
            <HttpRedirectCode>307</HttpRedirectCode>
        </Redirect>
    </RoutingRule>
</RoutingRules>
```

### Test

So now you should be able to see the resized image via this URL: `http://mybucket-public--prod.s3-website.eu-central-1.amazonaws.com/200x200/test.jpg`.

Sizes can be restricted using environment variables (see node script).

### Debug

Cloudwatch is a good way to check the logs on execution.



