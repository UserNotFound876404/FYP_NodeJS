const express = require('express');
const { MongoClient, ServerApiVersion, HostAddress } = require('mongodb');
const app = express();
const url = process.env.MongoDB_URL;
const dbName = "fyp";
const collectionName = "users";
const client = new MongoClient(url);
const bodyParser = require('body-parser');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use("/", express.static('/views'));


app.use((req, res, next) => {
    console.log("request body: ", req.body);
    console.log(req.method + ' ' + req.url + ' was requested at ' + Date(Date.now()).toString());
    next();
})


// const users = new Array(
//     { name: 'admin', password: 'admin' }
// );

// const SECRETKEY = '381Project';

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


//find mongodb
const findDatabase = async (db) => {
    var collection = db.collection(collectionName);
    let cursor = await collection.find();
    results = await cursor.toArray();
    return results;
}

//insert mongodb
const insertDatabase = async (db, object) => {
    var collection = db.collection(collectionName);
    collection.insertOne(object);
}

//update mongodb
const updateDatabase = async (db, oldUserId, newName, age, weight, height, meds, userId, gender) => {
    var collection = db.collection(collectionName);
    collection.updateMany({ 'userId': oldUserId }, { $set: { 'name': newName, 'weight': weight, 'height': height, 'medicine': meds, 'userId': userId, 'age': age, 'gender': gender.toUpperCase() } });
}

//delete mongodb
const deleteDatabase = async (db, userId) => {
    var collection = db.collection(collectionName);
    collection.deleteOne({ "userId": userId });
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

        // Remove password from response
        const { password: _, ...userData } = user;
        
        // Update lastUpdate on login
        userData.lastUpdate = new Date().toISOString();
        
        res.status(200).json({ 
            message: "Login successful",
            user: userData 
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

//create account
//curl -X POST -H "Content-Type: application/json" -d "{\"name\":\"Tom\",\"gender\":\"male\",\"email\":\"Tom@example.com\",\"password\":\"secret123\",\"telephone\":\"+85212345678\",\"birth\":\"1990-01-01\",\"streak\":0,\"medicine\":[{\"name\":\"meds0\",\"dosage\":\"10mg\",\"frequencyCount\":2,\"frequencyUnit\":\"daily\",\"time\":[\"08:00\",\"20:00\"]}]}" http://localhost:8099/createAccount
app.post("/createAccount", async (req, res, next) => {
    try {
        let newObject = {
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,     // Hash before saving!
            //telephone: req.body.telephone,   
            birth: req.body.birth,           // YYYY-MM-DD
            streak: 0,         
            medicine: [],
            gender: req.body.gender.toUpperCase(),
            lastUpdate: new Date().toISOString()  // Current timestamp (ISO format)
        };
        
        const db = client.db(dbName);
        await insertDatabase(db, newObject);
        res.status(200).json({ message: "Data inserted successfully" });
    } catch (err) {
        console.error("Error inserting data:", err);
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
app.post("/api/users/:email/medicine", async (req, res) => {  // :email instead of :userId
    try {
        const db = client.db(dbName);
        const email = req.params.email;  // "tom@example.com"
        
        const newMedicine = req.body;
        const database = await findDatabase(db);
        let userFound = false;
        
        database.forEach(async (object) => {
            if (object.email == email) {  // Match by email
                userFound = true;
                await db.collection("users").updateOne(
                    { email: email },  // Query by email
                    { 
                        $push: { medicine: newMedicine },
                        $currentDate: { lastUpdate: true }
                    }
                );
            }
        });
        
        if (!userFound) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.json({ message: "Medicine inserted successfully" });
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

//search
//curl "localhost:8099/api/search/userId/12345"
// app.get("/api/search/userId/:userId", async (req, res, next) => {
//         const db = client.db(dbName);
//         try {
//             const q = {
//                 userId: req.params.userId,
//                 // name: req.params.name,
//                 // age: req.params.age,
//                 // weight: req.params.weight,
//                 // height: req.params.height,
//                 // medicine: req.params.medicine,
//                 // gender: req.params.gender.toUpperCase()
//             };

//             Object.keys(q).forEach((k) => {
//                 const v = q[k];
//                 if (v == null || String(v).trim() === '') {
//                     delete q[k];
//                 }
//             });

//             const results = await searchDatabase(db, q);
//             res.status(200).type("json").send(results);
//         } catch (err) {
//             console.error('Search error:', err);
//             res.status(500).json({ error: 'Internal server error' });
//         }
// });

//port
app.listen(process.env.PORT || 8099);

