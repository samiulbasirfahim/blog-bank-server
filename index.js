const express = require("express")
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")
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

// mongodb
const uri = `mongodb+srv://${process.env.user}:${process.env.pass}@cluster0.9iutd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
})
const runMongo = async () => {
	try {
		await client.connect()
		const postCollection = client.db("Blog_post").collection("post")
		const userCollection = client.db("Blog_post").collection("user")
		const commentCollection = client.db("Blog_post").collection("comment")
		const notificationCollection = client
			.db("Blog_post")
			.collection("notification")

		app.post("/comment", verifyToken, async (req, res) => {
			const notificationForDuplicate = []
			const notificationForP = await postCollection.findOne({
				_id: ObjectId(req.body.postId),
			})
			const notificationForC = await commentCollection
				.find({ postId: req.body.postId })
				.toArray()
			const notificationForCommentAuthor = notificationForC.map(
				(commentAuthor) => commentAuthor.userEmail
			)
			notificationForDuplicate.push(notificationForP.author)
			notificationForDuplicate.push(...notificationForCommentAuthor)
			const notificationFor1 = [...new Set(notificationForDuplicate)]
			const notificationFor = notificationFor1.filter(
				(author) => author !== req.body.userEmail
			)
			notificationFor.forEach(async (n) => {
				const notificationInfo = {
					for: n,
					postId: req.body.postId,
					title: `${req.body.userName} commented on ${notificationForP.postTitle}`,
					detail: `comment: ${req.body.comment}`,
					time: req.body.time,
				}
				await notificationCollection.insertOne(notificationInfo)
			})
			res.send(await commentCollection.insertOne(req.body))
		})

		app.get("/comment/:postId", async (req, res) => {
			res.send(
				await commentCollection
					.find({ postId: req.params.postId })
					.sort({ _id: -1 })
					.toArray()
			)
		})

		app.post("/getToken", async (req, res) => {
			const email = req.body.email

			const token = jwt.sign({ email }, process.env.JWT_SECRET_KEY, {
				expiresIn: "7d",
			})
			const filter = { email: req.body.email }

			const options = { upsert: true }
			const updatedDoc = {
				$set: {
					email,
				},
			}
			const result = await userCollection.updateOne(
				filter,
				updatedDoc,
				options
			)
			res.send({ token, result })
		})
		// get post and search post
		app.get("/posts", async (req, res) => {
			const query = req?.query?.filter || {}
			const cursor = postCollection.find(query).sort({ _id: -1 })
			const result = await cursor.toArray()
			res.send(result)
		})
		//  get one post by id
		app.get("/post/:id", async (req, res) => {
			const postId = req.params.id
			const query = { _id: ObjectId(postId) }
			const result = await postCollection.findOne(query)
			res.send(result)
		})
		// update a post
		app.put("/updatePost/:id", verifyToken, async (req, res) => {
			const postId = req.params.id
			const query = { _id: ObjectId(postId) }
			const post = await postCollection.findOne(query)
			const postDetails = req.body.postBody
			if (post.author === req.tokenEmail) {
				const options = { upsert: true }
				const updatedDoc = {
					$set: {
						...postDetails,
					},
				}
				const result = await postCollection.updateOne(
					query,
					updatedDoc,
					options
				)
				res.send(result)
			} else {
				res.status(404).send("Forbidden")
			}
		})

		// create a new post
		app.post("/post", verifyToken, async (req, res) => {
			const body = req.body
			const tokenEmail = req.tokenEmail
			const document = {
				...body,
			}
			if (body.author === tokenEmail) {
				const result = await postCollection.insertOne(document)
				res.send({
					message: "success",
					inserted: true,
					insertedId: result.insertedId,
				})
			} else {
				res.status(403).send({ message: "authorization failed" })
			}
		})
		// get user posts
		app.get("/userPost", verifyToken, async (req, res) => {
			const email = req.headers.email
			const tokenEmail = req.tokenEmail
			if (email === tokenEmail) {
				const query = { author: email }
				const cursor = postCollection.find(query).sort({ _id: -1 })
				const result = await cursor.toArray()
				res.send(result)
			} else {
				res.status(404).send("forbidden")
			}
		})

		// delete a post by id
		app.delete("/deletePost/:id", verifyToken, async (req, res) => {
			const verifiedEmail = req.tokenEmail
			const id = req.params.id
			const query = { _id: ObjectId(id) }
			const post = await postCollection.findOne(query)
			if (post?.author === verifiedEmail) {
				const result = await postCollection.deleteOne(query)
				res.send(result)
			} else {
				res.status(404).send("forbidden")
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
