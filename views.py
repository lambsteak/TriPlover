from datetime import datetime
from flask import request, jsonify, redirect, render_template

from . import app, db


@app.route("/api/upload-frame", methods=["POST"])
def ping():
    frame = request.files["frame"]
    # doc = db.queued_frames.insert_one({"added_on": datetime.utcnow()})
    doc = db.queued_frames.insert_one({})
    frame.save("media/" + str(doc.inserted_id) + ".png")
    docs = db.identified_object.find()
    objects = []
    for doc in docs:
        db.identified_object.delete_one({"_id": doc["_id"]})
        del doc["_id"]
        objects.append(doc)
    return jsonify({"success": True, "objects": objects})


@app.route("/form", methods=["GET", "POST"])
def submit_form():
    if request.method == "GET":
        return render_template("update_des.html")
    return redirect("http://localhost:8000")
