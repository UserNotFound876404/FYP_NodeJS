const express = require('express');
const { MongoClient, ServerApiVersion, HostAddress,ObjectId  } = require('mongodb');
const app = express();
const url = process.env.MongoDB_URL;
const dbName = "fyp";
const collectionName = "users";
const client = new MongoClient(url);
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.use(express.static('public'));


app.use((req, res, next) => {
    console.log("request body: ", req.body);
    console.log(req.method + ' ' + req.url + ' was requested at ' + Date(Date.now()).toString());
    next();
})


// const SECRETKEY = 'secretkey';

//cookies
// const session = require('cookie-session');
// app.use(session({
//     name: 'loginSession',
//     keys: [SECRETKEY]
// }));

const searchDatabase = async (db, query) => {
    try {
        const collection = db.collection(collectionName);

        // Ensure query is an object; if empty, use {}
        const q = (query && typeof query === 'object' && Object.keys(query).length) ? query : {};

        const cursor = await collection.find(q);
        const results = await cursor.toArray();
        return results;
    } catch (err) {
        console.error('searchDatabase error:', err);
        throw err;
    }
};

const updateLoginTime = async (db, email) => {
    try {
        const collection = db.collection(collectionName);
        const updateTime = new Date().toLocaleString("en-US", { timeZone: 'Asia/Hong_Kong' });
        
        const result = await collection.updateOne(
            { email: email.toLowerCase() },
            { 
                $set: { 
                    lastLogin: updateTime
                }
            }
        );
        
        if (result.modifiedCount === 0) {
            throw new Error('User not found for login time update');
        }
        
        console.log(`Updated lastLogin for user: ${email}`);
        return true;
    } catch (err) {
        console.error('updateLoginTime error:', err);
        throw err;
    }
};


//find mongodb
const findDatabase = async (db) => {
    var collection = db.collection(collectionName);
    let cursor = await collection.find();
    results = await cursor.toArray();
    return results;
}

//insert mongodb
const insertDatabase = async (db, object) => {
    try{
        var collection = db.collection(collectionName);
        await collection.insertOne(object);
    }catch (err) {
        console.error("insertDatabase error:", err);  // Log for debugging
        throw err;  // Re-throw so caller can handle (e.g., return 500/409)
    }
}

//update mongodb
const updateDatabase = async (db, oldUserId, newName, age, weight, height, meds, userId, gender) => {
    var collection = db.collection(collectionName);
    collection.updateMany({ 'userId': oldUserId }, { $set: { 'name': newName, 'weight': weight, 'height': height, 'medicine': meds, 'userId': userId, 'age': age, 'gender': gender.toUpperCase() } });
}

//delete mongodb
const deleteDatabase = async (db, medicineName) => {
    var collection = db.collection(collectionName);
    collection.deleteOne({ "name": medicineName });
}

app.get('/', (req, res, next) => {
    res.redirect("/home");
});

app.get("/home", (req, res, next) => {
    res.write("<h1>home</h1>");
})

//Restful API
//read
//curl "localhost:8099/api"
app.get("/api", async (req, res, next) => {
    try {
        const db = client.db(dbName);
        const result = await findDatabase(db); // await the helper
        res.status(200).json(result); // sends JSON and ends response
    } catch (err) {
        console.error("Error fetching database:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

//curl -X POST http://localhost:8099/login -H "Content-Type: application/json" -d "{\"email\":\"tom@example.com\",\"password\":\"secret123\"}"
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }

        const db = client.db(dbName);
        
        // Find user by email (using your searchDatabase)
        const users = await searchDatabase(db, { email: email.toLowerCase() });
        const user = users[0]; // searchDatabase returns array
        
        // Check if user exists
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        // TODO: In production, compare hashed password:
        // if (user.password !== password) {
        if (user.password !== password) {  // Currently plain text comparison
            return res.status(401).json({ error: "Invalid credentials" });
        }


        await updateLoginTime(db, email);
        
        res.status(200).json({ 
            message: "Login successful",
            user: user
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/updatestreak",async (req,res)=> {
    


})

//retrieve data by id
app.post("/data", async (req, res) => {
    try {
        const { email } = req.body;  // ✅ Email from request body
        
        // Validation
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: "Valid email required in body" });
        }

        const db = client.db(dbName);
        
        // ✅ Find user by email (EXACTLY like your login endpoint)
        const users = await searchDatabase(db, { email: email.toLowerCase() });
        const user = users[0];
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.status(200).json({ 
            message: "Profile fetched successfully",
            user: user 
        });

    } catch (err) {
        console.error("Data fetch error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



//create account
//curl -X POST -H "Content-Type: application/json" -d "{\"name\":\"Tom\",\"gender\":\"male\",\"email\":\"Tom@example.com\",\"password\":\"secret123\",\"telephone\":\"+85212345678\",\"birth\":\"1990-01-01\",\"streak\":0,\"medicine\":[{\"name\":\"meds0\",\"dosage\":\"10mg\",\"frequencyCount\":2,\"frequencyUnit\":\"daily\",\"time\":[\"08:00\",\"20:00\"]}]}" http://localhost:8099/createAccount
app.post("/createAccount", async (req, res, next) => {
    try {
        // Basic validation
        const { name, email, password, birth, gender } = req.body;
        if (!name || !email || !password || !birth || !gender) {
            return res.status(400).json({ error: "Missing required fields: name, email, password, birth, gender" });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const db = client.db(dbName);
        
        // Check if email already exists (using your existing searchDatabase)
        const existingUsers = await searchDatabase(db, { email: normalizedEmail });
        if (existingUsers.length > 0) {
            return res.status(409).json({ error: "Account with this email already exists" });
        }
    
        let newObject = {
            uid: uuidv4(), 
            name: name.trim(),
            email: normalizedEmail,
            password: password,     // Hash before saving in production!
            birth: birth,           // YYYY-MM-DD
            streak: 0,         
            medicine: [],
            gender: gender.toUpperCase().trim(),
            lastUpdate: new Date().toLocaleString("en-US", { timeZone: 'Asia/Hong_Kong' })
        };
        
        await insertDatabase(db, newObject);
        res.status(201).json({ message: "Account created successfully" });
    } catch (err) {
        console.error("Error creating account:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



//update
//curl -X PUT -d "name=demo&age=20&userId=11111&weight=50&height=177&medicine=meds0&medicine=meds4&medicine=meds2&gender=Male" "localhost:8099/api/userId/22222"
// app.put("/api/userId/:userId", async (req, res, next) => {
//     try {
//         const db = client.db(dbName);
//         const database = await findDatabase(db);
//         database.forEach((object) => {
//             if (object.userId == req.params.userId) {
//                 updateDatabase(db, req.params.userId, req.body.name, req.body.age, req.body.weight, req.body.height, req.body.medicine, req.body.userId, req.body.gender);
//             }
//         })
//         res.status(200).send("Data updated");
//     } catch (err) {
//         console.error("Error fetching database:", err);
//         res.status(500).json({ error: "Internal server error" });

//     }
// })

//update medicine 
app.post("/medicine/:email", async (req, res) => {
    try {
        const db = client.db(dbName);
        const email = req.params.email;

        const newMedicine = req.body;

        const user = await db.collection("users").findOne({ email: email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await db.collection("users").updateOne(
            { email: email },
            { 
                $push: { medicine: newMedicine },
                $set: { 
                    lastUpdate: new Date().toLocaleString("en-US", { timeZone: 'Asia/Hong_Kong' })
                }
            }
        );

        res.json({ message: "Medicine inserted successfully" });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

//delete the medicine object using the name attribute in mongodb
app.delete("/medicine/:email", async (req, res) => {
    try {
        const db = client.db(dbName);
        const email = req.params.email;
        const { medicineName } = req.body;  // medicineName from body (secure)
        
        if (!medicineName) {
            return res.status(400).json({ error: "medicineName required in body" });
        }

        const user = await db.collection("users").findOne({ email: email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Delete medicine by name using $pull (no insert logic)
        const result = await db.collection("users").updateOne(
            { email: email },
            { 
                $pull: { medicine: { name: medicineName } }, 
                $set: { 
                    lastUpdate: new Date().toLocaleString("en-US", { timeZone: 'Asia/Hong_Kong' })
                }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: "Medicine not found or already deleted" });
        }

        res.json({ 
            message: "Medicine deleted successfully",
            deletedCount: result.modifiedCount 
        });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



//delete
//curl -X DELETE "localhost:8099/api/delete/userId/11111"
// app.delete("/api/delete/userId/:userId", async (req, res, next) => {
//     try {
//         const db = client.db(dbName);
//         const database = await findDatabase(db);
//         database.forEach((object) => {
//             if (object.userId == req.params.userId) {
//                 deleteDatabase(db, req.params.userId);
//             }
//         })
//         res.status(200).type("json").send("Data deleted");
//     } catch (err) {
//         console.error("Error fetching database:", err);
//         res.status(500).json({ error: "Internal server error" });

//     }
// })


//port
app.listen(process.env.PORT);
