const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());



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

    app.get("/job", async(req,res)=> {
        const email = req.query.email;
        const query = {};
        if(email) {
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

    app.get("/application", async(req, res)=> {
      const email = req.query.email;
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
