var config=require('./config')
var _=require('lodash')
var example=require('../examples')
var examples=_.fromPairs(_.toPairs(example)
    .filter(x=>x[1].Type==="AWS::Lambda::Function")
    .map(x=>[x[0],{"Fn::GetAtt":[x[0],"Arn"]}]))

module.exports={
    "Alexa":{
      "Type" : "AWS::Lambda::Permission",
      "Properties" : {
        "Action" : "lambda:InvokeFunction",
        "FunctionName" : {"Fn::GetAtt":["FulfillmentLambda","Arn"]},
        "Principal" : "alexa-appkit.amazon.com"
      }
    },
    "FulfillmentCodeVersion":{
        "Type": "Custom::S3Version",
        "Properties": {
            "ServiceToken": { "Fn::GetAtt" : ["CFNLambda", "Arn"] },
            "Bucket": {"Ref":"BootstrapBucket"},
            "Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/fulfillment.zip"},
            "BuildDate":(new Date()).toISOString()
        }
    },
    "FulfillmentLambda": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
            "S3Bucket": {"Ref":"BootstrapBucket"},
            "S3Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/fulfillment.zip"},
            "S3ObjectVersion":{"Ref":"FulfillmentCodeVersion"}
        },
        "Environment": {
          "Variables": Object.assign({
            ES_TYPE:{"Fn::GetAtt":["Var","QnAType"]},
            ES_INDEX:{"Fn::GetAtt":["Var","index"]},
            ES_ADDRESS:{"Fn::GetAtt":["ESVar","ESAddress"]},
            LAMBDA_DEFAULT_QUERY:{"Ref":"ESQueryLambda"},
            LAMBDA_LOG:{"Ref":"ESLoggingLambda"},
            ES_SERVICE_QID:{"Ref":"ESQidLambda"},
            ES_SERVICE_PROXY:{"Ref":"ESProxyLambda"},
            "ERRORMESSAGE":config.ErrorMessage,
            "EMPTYMESSAGE":config.EmptyMessage
          },examples)
        },
        "Handler": "index.handler",
        "MemorySize": "1408",
        "Role": {"Fn::GetAtt": ["FulfillmentLambdaRole","Arn"]},
        "Runtime": "nodejs6.10",
        "Timeout": 300,
        "Tags":[{
            Key:"Type",
            Value:"Fulfillment"
        }]
      }
    },
    "InvokePolicy": {
      "Type": "AWS::IAM::ManagedPolicy",
      "Properties": {
        "PolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [{
              "Effect": "Allow",
              "Action": [
                "lambda:InvokeFunction"
              ],
              "Resource":[
                "arn:aws:lambda:*:*:function:qna-*",
                "arn:aws:lambda:*:*:function:QNA-*",
                {"Fn::GetAtt":["ESQueryLambda","Arn"]},
                {"Fn::GetAtt":["ESQidLambda","Arn"]},
                {"Fn::GetAtt":["ESProxyLambda","Arn"]},
              ]
            }]
        },
        "Roles": [{"Ref": "FulfillmentLambdaRole"}]
      }
    },
    "FulfillmentLambdaRole": {
      "Type": "AWS::IAM::Role",
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Principal": {
                "Service": "lambda.amazonaws.com"
              },
              "Action": "sts:AssumeRole"
            }
          ]
        },
        "Path": "/",
        "ManagedPolicyArns": [
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
          {"Ref":"EsPolicy"}
        ]
      }
    }
}

