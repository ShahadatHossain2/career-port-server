const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const cookieParser = require('cookie-parser');

const port = process.env.PORT || 5000;

const admin = require("firebase-admin");

// var serviceAccount = require("./firebase-admin-key.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});


//middle-ware
app.use(cors({
  origin: [ 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if(!token) {
    return res.status(401).send({message: "Unauthorized Access!"})
  }
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decode)=> {
    if(err) {
      return res.status(401).send({message: "Unauthorized Access!"})
    }
    req.decode = decode;
    next();
  })
}

const verifyFirebaseToken = async(req, res, next) => {
  const authHeader = req.headers?.authorization;
  
  if(!authHeader) {
    return next();
  }
const token = authHeader.split(' ')[1];
  const userInfo = await admin.auth().verifyIdToken(token);
  req.tokenEmail = userInfo.email;
  next()
  
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hwn7uvq.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const jobPortalCollection = client.db('jobPort').collection('jobs');
    const usersCollection = client.db('jobPort').collection('users');
    const applicationCollection = client.db('jobPort').collection('application');


    //jwt api
    app.post("/jwt", async(req, res)=> {
      const {email} = req.body;
      const user = {email};
      const token = jwt.sign(user, process.env.JWT_ACCESS_SECRET, {expiresIn: '1d'})

      res.cookie('token', token, {
        httpOnly: true,
        secure: false,
      })
      res.send({success: true})
    })

    app.get("/job/application", async(req, res)=> {
      const email = req.query.email;
      const query = {hrEmail: email};
      const jobs = await jobPortalCollection.find(query).toArray();
      for (const job of jobs) {
        const query = {jobId: job._id.toString()}
        const applicationCount = await applicationCollection.countDocuments(query);
        job.application_count = applicationCount;
      }
      res.send(jobs)
    })
    
    app.get("/job", verifyFirebaseToken, async(req,res)=> {
        const email = req.query.email;
        const query = {};
        
        if(email) {
          if(req.tokenEmail != email) {
          return res.status(403).send({message: "Forbidden"})
        }
          query.hrEmail = email
        }
        const result = await jobPortalCollection.find(query).toArray();
        res.send(result);
    })

    app.get("/users", async(req,res)=> {
        const result = await usersCollection.find({}).toArray();
        res.send(result);
    })

    app.get("/job/:id", async(req,res)=> {
        const query = {_id: new ObjectId(req.params.id)};
        const result = await jobPortalCollection.findOne(query);
        res.send(result);
    })

    app.get("/application",verifyToken, async(req, res)=> {
      const email = req.query.email;
      // console.log("Inside applications api", req.cookies)
      if(email !== req.decode.email) {
        return res.status(403).send({message: "Access denied"})
      }
      const query = {applicant: email}
      const result = await applicationCollection.find(query).toArray();
      for (const application of result) {
        const jobId = application.jobId;
        const jobQuery = {_id: new ObjectId(jobId)};
        const job = await jobPortalCollection.findOne(jobQuery);
        application.name = job.name;
        application.position = job.position;
        application.photo = job.photo;
        application.deadline = job.deadline;
      }
      res.send(result);
    })

    app.get("/application/job/:id", async(req, res)=> {
      const job_Id = req.params.id;
      const query = {jobId : job_Id};
      const result = await applicationCollection.find(query).toArray();
      res.send(result);
    })

    app.post("/job", async(req, res)=> {
        const result = await jobPortalCollection.insertOne(req.body);
        res.send(result);
    })

    app.post("/users", async(req, res)=> {
        const result = await usersCollection.insertOne(req.body);
        res.send(result);
    })

    app.post("/application", async(req, res)=> {
      const result = await applicationCollection.insertOne(req.body);
      res.send(result);
    })

    app.patch("/application/:id", async(req, res)=> {
      const filter = {_id: new ObjectId(req.params.id)};
      const updatedDoc = {
        $set: {
          status: req.body.status
        }
      }
      const result = await applicationCollection.updateOne(filter,updatedDoc);
      res.send(result)
    })

    app.delete("/application/:id", async(req, res)=>{
      const query = {_id: new ObjectId(req.params.id)}
      const result = await applicationCollection.deleteOne(query)
      res.send(result);
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
  }
}
run().catch(console.dir);


app.get("/", (req, res)=> {
    res.send("Job Port server is running!")
})

app.listen(port, ()=> {
    console.log("Job Portal is running on port : ", port)
})
