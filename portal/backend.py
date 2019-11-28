from flask import Flask, jsonify, abort, make_response, request, url_for
from flask import render_template, redirect
import pymongo
import json
import pyttsx3


client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["database"]
col = db["objects"]

app = Flask(__name__)

@app.route("/", methods = ['GET'])
def cleardb():
    db.col.drop()
    return jsonify({}),200

@app.route("/update_description" , methods=['POST'])
def home():
    print(db.list_collection_names())
    # status = 201
    res = eval(request.data)
    location = res['location']
    object_name = res['object_name']
    description = res['description']
    print(location)
    dict = { "location": location, "object_name": object_name, "description" : description}
    x = col.find_one(dict)
    if x == None :
        col.insert_one(dict)
        status = 201
    else :
        status = 401
    return jsonify({}),status

@app.route("/speak/<location>/<obj_name>", methods = ['GET'])
def speak(location, obj_name):
    document = {"location":location,"object_name" : obj_name}
    x = col.find_one(document)
    # print(x)
    description = x['description']
    engine = pyttsx3.init()
    voiceId = "com.apple.speech.synthesis.voice.samantha"
    engine.setProperty('voice', voiceId)
    engine.say(description)
    engine.runAndWait()
    status = 200
    return jsonify({}, status)


if __name__ == '__main__':
	app.run(debug=True,port=5000)
