const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv");
dotenv.config();
const PORT = 8000;
const URL = process.env.DB;
console.log(URL);

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

// const bodyParser = require("body-parser");
// app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send(`
  <div style="background-color:black; color:white;height:100%;">
  <h2 style=" text-align:center">
  Mentor and Student Assigning with Database
  </h2>
  <h4  style=" text-align:center">Here youu can see the assigned mentor ,students and mentor list ,student list
  </h4> 
  <h2  style=" text-align:center">By clicking the link given below</h2>
  <div style="display:flex; justify-content:center;padding:20px;"> 
  <div style=" padding:20px;"> 
  <p style="color:white;background-color:white; padding:10px 40px; margin:10px 20px; text-align:center ">
    <a href="/mentors" style="text-decoration:none;color:black;">
    All Mentors list
    </a>
  </p>
  <p style="color:white;background-color:white; padding:10px 5px; margin:10px 20px; text-align:center ">
  <a href="/students"  style="text-decoration:none;color:black;">
  All Students List
  </a>
  </p>
 
  <p style="color:white;background-color:white; padding:10px 5px; margin:10px 20px; text-align:center ">
  <a href="/students-without-mentors"  style="text-decoration:none;color:black;">
  Student without mentor
  </a>
  </p>

 
 
  </div>
  </div>
  </div>  `);
});

// Adding mentor
app.post("/mentor", async (req, res) => {
  try {
    const { mentorName, mentorMail } = req.body;
    const connection = await MongoClient.connect(URL);
    const db = connection.db("datacollection");
    const mentor = await db.collection("mentors").insertOne({
      mentorName: mentorName,
      mentorMail: mentorMail,
      students: [],
    });
    res.send({
      Message: "Mentor created successfully",
      result: mentor,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "something went wrong please try again later",
    });
  }
});

// here we can get the all mentor details
app.get("/mentors", async (req, res) => {
  try {
    const connection = await MongoClient.connect(URL);
    const db = connection.db("datacollection");
    const mentors = await db.collection("mentors").find({}).toArray();
    await connection.close();
    res.send(mentors);
  } catch (error) {
    res.status(500).json({
      Message: "Something went wrong",
    });
  }
});

//Adding students
app.post("/student", async (req, res) => {
  try {
    const { studentName, studentMail } = req.body;
    const newStudent = {
      studentName: studentName,
      studentMail: studentMail,
      oldMentor: null,
      currentMentor: null,
    };
    const connection = await MongoClient.connect(URL);
    const db = connection.db("datacollection");
    const result = await db.collection("students").insertOne(newStudent);
    connection.close();
    res.send({
      message: "Student created successfully",
      result: result,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// get all the students detalis
app.get("/students", async (req, res) => {
  try {
    const connection = await MongoClient.connect(URL);
    const db = connection.db("datacollection");
    const data = await db.collection("students").find({}).toArray();
    const students = data.map((item) => ({
      studentId: item._id.toString(),
      studentName: item.studentName,
      studentEmail: item.studentMail,
      oldMentor: item.oldMentor,
      currentMentor: item.currentMentor,
    }));
    connection.close();
    res.send(students);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Internal server error",
    });
  }
});

// 3. Write API to Assign a student to Mentor
// a)Select a mentor and Add multiple Students

app.post("/studentAssignToMentor", async (req, res) => {
  try {
    const { mentorId, studentId } = req.body;
    const mentorObjectId = new ObjectId(mentorId);
    const studentObjectId = new ObjectId(studentId);
    const connection = await MongoClient.connect(URL);
    const db = connection.db("datacollection");
    const mentorCollection = db.collection("mentors");
    const studentCollection = db.collection("students");
    const mentor = await mentorCollection.findOne({
      _id: mentorObjectId,
    });
    const student = await studentCollection.findOne({
      _id: studentObjectId,
    });

    if (!mentor || !student) {
      res.status(404).send({
        error: "Mentor or Student not found",
      });
      return; // Return early to prevent further execution
    }

    // UPDATE PARTICULAR STUDENT
    await studentCollection.updateOne(
      { _id: studentObjectId },
      {
        $set: {
          oldMentor: student.currentMentor,
          currentMentor: mentor.mentorName,
        },
      }
    );

    // ASSIGN MENTOR
    await mentorCollection.updateOne(
      { _id: mentorObjectId },
      {
        $push: {
          students: {
            studentName: student.studentName,
            studentMail: student.studentMail,
            studentId: studentObjectId,
          },
        },
      }
    );

    connection.close();
    res.send({
      success: true,
      message: "Mentor will be assigned",
      mentorName: mentor.mentorName,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

//b)API to A student who has a mentor should not be shown in List
app.get("/students-without-mentors", async (req, res) => {
  try {
    const connection = await MongoClient.connect(URL);
    const db = connection.db("datacollection");
    const data = await db
      .collection("students")
      .find({
        oldMentor: { $exists: false },
        currentMentor: { $exists: false },
      })
      .toArray();
    const students = data.map((item) => ({
      studentId: item._id.toString(),
      studentName: item.studentName,
      studentMail: item.studentMail,
      oldMentor: item.oldMentor,
      currentMentor: item.currentMentor,
    }));
    connection.close();
    if (students.length > 0) {
      res.send(students);
    } else {
      res.send({
        message: "No students with both mentors",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Internal Server Error",
    });
  }
});

//
// 4. Write API to Assign or Change Mentor for particular Student
// Select a Student and Assign a Mentor
app.post("/changeMentor", async (req, res) => {
  try {
    const { mentorId, studentId, currentMentor: newcurrentMenter } = req.body;
    const mentorObjectId = new ObjectId(mentorId);
    const studentObjectId = new ObjectId(studentId);
    const connection = await MongoClient.connect(URL);
    const db = connection.db("datacollection");
    const mentorCollection = db.collection("mentors");
    const studentCollection = db.collection("students");
    const mentor = await mentorCollection.findOne({
      _id: mentorObjectId,
    });
    const student = await studentCollection.findOne({
      _id: studentObjectId,
    });
    if (!mentor || !student) {
      res.status(404).send({ error: "Mentor or student not found" });
      return;
    }
    await studentCollection.updateOne(
      { _id: studentObjectId },
      {
        $set: {
          oldMentor: student.currentMentor,
          currentMentor: newcurrentMenter,
        },
      }
    );
    await mentorCollection.updateOne(
      { _id: mentorObjectId },
      {
        $push: {
          students: {
            studentName: student.studentName,
            studentMail: student.studentMail,
            studentId: studentObjectId,
          },
        },
      }
    );
    connection.close();
    res.send({
      success: true,
      message: "mentor will be changed for this student",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Interval server error",
    });
  }
});

// 5. Write API to show all students for a particular mentor
app.get("/:mentorName/students", async (req, res) => {
  try {
    const mentorName = req.params.mentorName;
    const connection = await MongoClient.connect(URL);
    const db = connection.db("datacollection");
    const mentorsColleciton = db.collection("mentors");
    const mentor = await mentorsColleciton.findOne({
      mentorName: mentorName,
    });
    res.send(mentor);
  } catch (error) {
    console.log(error);
  }
});

//6. Write API to show the previously assigned mentor for a particular student
app.get("/oldmentorByStudent/:studentName", async (req, res) => {
  try {
    const { studentName } = req.params;
    const connection = await MongoClient.connect(URL);
    const db = connection.db("datacollection");
    const studentsCollection = db.collection("students");
    const student = await studentsCollection.findOne({ studentName });

    if (student.oldMentor !== null) {
      res.send({
        message: "No older mentor for this student",
      });
    } else {
      console.log("Error while retrieving data from DB");
      return res.send({
        message: "Error while retrieving data from DB",
      });
    }
  } catch (error) {
    console.log(error);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running in ${PORT}`);
});

// Jker79ql0Lhw3ppZ
