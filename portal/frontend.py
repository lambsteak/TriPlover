from flask import Flask, jsonify, abort, make_response, request, url_for
from flask import render_template, redirect
import requests
import json
import os



app = Flask(__name__)

backend_url = "http://127.0.0.1:5000"

@app.route('/',methods = ['GET','POST'])
def upload_act():
    if request.method =='GET':
        return render_template('update_des.html')
    elif request.method == 'POST':
        location = request.form['location']
        object_name = request.form["objname"]
        description = request.form["description"]
        send = {
		"location" : location,
		"object_name" : object_name,
		"description" : description}
        send = json.dumps(send)
        resp = requests.post(backend_url+"/update_description", send)
        if(resp.status_code!=201):
            return render_template("errorpage.html",status=resp.status_code)
        return redirect("/")

if __name__ == '__main__':
	app.run(host = '127.0.0.1',port = 8000, debug= True)
