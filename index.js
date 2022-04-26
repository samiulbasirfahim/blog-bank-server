const express = require("express")
const { MongoClient, ServerApiVersion } = require("mongodb")
const cors = require("cors")
const jwt = require("jsonwebtoken")
require("dotenv").config()
const port = 5000
const app = express()

// using middleware
app.use(cors())
app.use(express.json())

// custom middleware for authentication
const verifyToken = async (req, res, next) => {
	const token = req?.headers?.authorization.split(" ")[1]
	jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
		if (err) {
			res.status(401).send({ message: "authentication failed" })
		} else {
			req.tokenEmail = decoded.email
			next()
		}
	})
}
// json web token generator for authentication
app.post("/getToken", (req, res) => {
	const email = req.body.email
	console.log(email)
	const token = jwt.sign({ email }, process.env.JWT_SECRET_KEY, {
		expiresIn: "7d",
	})
	res.send({ token: token })
	// res.send({email: email})
})

// Mongodb

const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.9iutd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
})
const runMongo = async () => {
	try {
		await client.connect()
		const postCollection = client.db("Blog_post").collection("post")
		// get post and search post
		app.get("/posts", async (req, res) => {
			const query = req?.query?.filter || {}
			const cursor = postCollection.find(query)
			const result = await cursor.toArray()
			res.send(result)
		})
		//  get one post by id

		// create a new post
		app.post("/post", verifyToken, async (req, res) => {
			const body = req.body
			const tokenEmail = req.tokenEmail
            const document = {
                ...body
            }
            console.log(document);
			if (body.author === tokenEmail) {
                const result = await postCollection.insertOne(document)
                console.log(result);
				res.send({ message: "success", inserted: true, insertedId : result.insertedId })
			} else {
				res.status(403).send({ message: "authorization failed" })
			}
		})
	} finally {
		/* mongodb connection closed (if needed) */
	}
}

runMongo().catch(console.dir)

app.get("/", (req, res) => {
	res.send("Hello, world")
})

// run server
app.listen(process.env.PORT || 5000)
