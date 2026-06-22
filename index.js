const express = require('express');
const cors = require('cors');
const app = express()
const port = 5000
require('dotenv').config();

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


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
    const paymentCollection = database.collection("payments");

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


    // =================== featured api ====================
    app.get('/api/featured-prompts', async (req, res) => {
      try {
        const result = await promptCollection
          .find({ status: "approved", visibilityStatus: "Public" })
          .sort({ copyCount: -1 })
          .limit(6)
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });




    // ========================= api id details ===================
    app.get('/api/prompts/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await promptCollection.findOne({ _id: new ObjectId(id) });
        if (!result) return res.status(404).send({ message: "Prompt not found" });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });




    // ============================ payments ==============
    app.post('/api/create-payment-intent', async (req, res) => {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: 500,
          currency: 'usd',
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).send({ message: "Payment error", error: error.message });
      }
    });

    app.post('/api/payment-success', async (req, res) => {
      try {
        const { email, transactionId, amount } = req.body;
        const payment = {
          email,
          transactionId,
          amount,
          createdAt: new Date().toISOString(),
        };
        await paymentCollection.insertOne(payment);
        await userCollection.updateOne(
          { email },
          { $set: { plan: "premium" } }
        );
        res.send({ success: true });
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    app.get('/api/admin/payments', async (req, res) => {
      try {
        const result = await paymentCollection.find().sort({ createdAt: -1 }).toArray();
        res.send(result);
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