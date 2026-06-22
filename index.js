const express = require('express');
const cors = require('cors');
const app = express()
const port = 5000
require('dotenv').config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.get('/', (req, res) => {
  res.send('Hello World!')
})


const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("prompt_verse");
    const promptCollection = database.collection("prompts");
    const userCollection = database.collection("user");

    app.post("/api/prompts", async (req, res) => {
      const prompt = req.body;
      const result = await promptCollection.insertOne(prompt);
      res.send(result);
    });


    app.get('/api/creator-prompts', async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }
        const query = { creatorEmail: email };
        const result = await promptCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    app.get('/api/user-prompts', async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }
        const query = { userEmail: email };
        const result = await promptCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // ============ admin ===============
    app.get('/api/admin/users', async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    app.patch('/api/admin/users/:id/role', async (req, res) => {
      try {
        const { id } = req.params;
        const { role } = req.body;
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    app.delete('/api/admin/users/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // =============== all prompts ==========
    app.get('/api/admin/prompts', async (req, res) => {
      try {
        const result = await promptCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    app.patch('/api/admin/prompts/:id/status', async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        const result = await promptCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    app.delete('/api/admin/prompts/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await promptCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });
    // =============== all prompts ==========


    // =============== all stats ==========
    app.get('/api/admin/stats', async (req, res) => {
      try {
        const totalUsers = await userCollection.countDocuments();
        const totalPrompts = await promptCollection.countDocuments();
        const totalCopiesAgg = await promptCollection.aggregate([
          { $group: { _id: null, total: { $sum: "$copyCount" } } }
        ]).toArray();

        const engineAgg = await promptCollection.aggregate([
          { $group: { _id: "$aiEngine", prompts: { $sum: 1 }, copies: { $sum: "$copyCount" } } }
        ]).toArray();

        res.send({
          totalUsers,
          totalPrompts,
          totalCopies: totalCopiesAgg[0]?.total || 0,
          engineStats: engineAgg,
        });
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})