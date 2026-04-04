const express = require('express');
const { MongoClient, ServerApiVersion, HostAddress, ObjectId } = require('mongodb');
const app = express();
const url = process.env.MongoDB_URL;
const dbName = "fyp";
const collectionName = "users";
const client = new MongoClient(url);
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const getHKT = () => {
  return new Date().toLocaleString("en-US", { 
    timeZone: "Asia/Hong_Kong",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false 
  });
};

const getHKTDateOnly = () => {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Hong_Kong" }); // YYYY-MM-DD
};

// ISO timestamp in HKT
const getHKTISO = () => {
  const hktDate = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Hong_Kong" });
  return new Date(hktDate + "T00:00:00+08:00").toISOString();
};



app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.use(express.static('public'));


app.use((req, res, next) => {
    console.log("request body: ", req.body);
    console.log(req.method + ' ' + req.url + ' was requested at ' + Date(Date.now()).toString());
    next();
})

const searchDatabase = async (db, query) => {
    try {
        const collection = db.collection(collectionName);
        const cursor = await collection.find(query);
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
        const updateTime = getHKT();

        const result = await collection.updateOne(
            { email: email.toLowerCase() },
            {
                $set: {
                    lastLogin: updateTime
                }
            }
        );

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
    try {
        var collection = db.collection(collectionName);
        await collection.insertOne(object);
    } catch (err) {
        console.error("insertDatabase error:", err);  // Log for debugging
        throw err;  // Re-throw so caller can handle (e.g., return 500/409)
    }
}
//insert health report
const insertReportDatabase = async (db, object) => {
    try {
        var collection = db.collection("healthReport");
        await collection.insertOne(object);
    } catch (err) {
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

//find HealthReport Database

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
app.post("/login", async (req, res,next) => {
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

//retrieve data by id
app.post("/data", async (req, res,next) => {
    try {
        const { email } = req.body;

        // Validation
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: "Valid email required in body" });
        }
        const db = client.db(dbName);
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
            console.log("Same email exits:" + existingUsers);
            return res.status(409).json({ error: "Account with this email already exists" });
        }
        const uid = uuidv4();

        let newObject = {
            uid: uid,
            name: name.trim(),
            email: normalizedEmail,
            password: password,    
            birth: birth,           // YYYY-MM-DD
            streak: 0,
            medicine: [],
            gender: gender.toUpperCase().trim(),
            lastUpdate: getHKT(),
            streakHistory: []
        };
        await insertDatabase(db, newObject);
        await insertReportDatabase(db, {uid: uid})
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
app.post("/medicine/:uid", async (req, res) => {
    try {
        const db = client.db(dbName);
        const uid = req.params.uid;

        const newMedicine = req.body;

        const user = await db.collection("users").findOne({ uid: uid });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await db.collection("users").updateOne(
            { uid: uid },
            {
                $push: { medicine: newMedicine },
                $set: {
                    lastUpdate: getHKT()
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
// DELETE: remove one medicine by name
app.delete("/managemedicine/:uid/:medicineName", async (req, res) => {
    try {
        const db = client.db(dbName);
        const { uid, medicineName } = req.params;

        if (!uid || !medicineName) {
            return res.status(400).json({ error: "uid and medicineName required in URL" });
        }

        const user = await db.collection("users").findOne({ uid: uid });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const result = await db.collection("users").updateOne(
            { uid: uid },
            {
                $pull: { medicine: { name: medicineName } },
                $set: { lastUpdate: getHKT() }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: "Medicine not found or already deleted" });
        }

        res.json({
            message: "Medicine deleted successfully",
            deletedCount: result.modifiedCount
        });
    } catch (err) {
        console.error("Error deleting medicine:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/finishMeds", async (req, res) => {
    try {
        const { uid, medicineName, medicineTime } = req.query;
        if (!uid || !medicineName || !medicineTime) {
            return res.status(400).json({ error: "uid, medicineName, and medicineTime required" });
        }

        const db = client.db(dbName);
        const user = await db.collection(collectionName).findOne({ uid });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // SERVER TIME
        const hkNow = getHKT(); 
        const today = getHKTDateOnly();
        const todayDateObj = new Date(hkNow);

        // Find medicine + validate medicineTime exists
        const medicine = user.medicine?.find(m => m.name === medicineName);
        if (!medicine?.time?.length) {
            return res.status(404).json({ error: "Medicine not found" });
        }
        if (!medicine.time.includes(medicineTime)) {
            return res.status(400).json({ error: `medicineTime "${medicineTime}" not in schedule for ${medicineName}` });
        }

        //CHECK IF MEDICINE IS DUE TODAY (Daily + Weekly support)
        const dayOfWeek = todayDateObj.getDay() + 1; // 1=Sunday, 2=Monday, ..., 7=Saturday
        const repeatDays = medicine.repeatDays || [];
        const isWeekly = repeatDays.length > 0;
        
        // Daily medicines: due every day
        // Weekly medicines: due only on selected days
        const isDueToday = !isWeekly || repeatDays.includes(dayOfWeek);
        
        if (!isDueToday) {
            return res.status(400).json({ 
                error: `Medicine "${medicineName}" is not due today (scheduled for days: ${repeatDays.join(',')})` 
            });
        }

        // 30min check + streak logic
        const hkDate = getHKTDateOnly();
        const scheduledTime = new Date(hkDate + "T" + medicineTime + ":00+08:00");
        const isWithin30Min = Math.abs(Date.now() - scheduledTime) <= 30 * 60 * 1000;
        const status = isWithin30Min ? "taken" : "missed";

        // Update history
        const streakHistory = user.streakHistory || [];
        let todayEntry = streakHistory.find(e => e.date === today);
        
        if (!todayEntry) {
            todayEntry = {
                date: today,
                medicines: [],
                completed: false
            };
            streakHistory.unshift(todayEntry);
        }

        // Remove old entry for this dose (if exists) and add new one
        todayEntry.medicines = todayEntry.medicines
            .filter(d => !(d.name === medicineName && d.time === medicineTime))
            .concat([{
                name: medicineName,
                time: medicineTime,
                status,
                timestamp: hkNow,
                within30Min: isWithin30Min
            }]);

        //STREAK CALCULATION: Only check medicines due TODAY
        const dueToday = user.medicine.flatMap(m => {
            const medRepeatDays = m.repeatDays || [];
            const medIsWeekly = medRepeatDays.length > 0;
            const medDueToday = !medIsWeekly || medRepeatDays.includes(dayOfWeek);
            
            // Only include if due today
            if (!medDueToday) return [];
            
            return m.time.map(t => ({ name: m.name, time: t }));
        });

        const takenToday = todayEntry.medicines.filter(
            d => d.status === "taken" && d.within30Min
        ).length;

        // Check if all due doses are taken
        const takenKeys = new Set(
            todayEntry.medicines
                .filter(d => d.status === "taken" && d.within30Min)
                .map(d => `${d.name}_${d.time}`)
        );

        const missing = dueToday.filter(d => !takenKeys.has(`${d.name}_${d.time}`));
        
        if (missing.length > 0) {
            console.warn("Missing or incomplete doses today:", missing);
        }

        todayEntry.completed = takenToday === dueToday.length && dueToday.length > 0;
        
        //NO RESET: Streak only increases or stays the same
        let newStreak = user.streak || 0;
        
        if (dueToday.length > 0 && todayEntry.completed) {
            // All due medicines taken → increase streak
            newStreak = (user.streak || 0) + 1;
        }
        // Otherwise: streak stays unchanged (no reset)

        // ONE UPDATE
        await db.collection(collectionName).updateOne(
            { uid },
            { $set: { streakHistory, streak: newStreak, lastUpdate: hkNow } }
        );

        res.json({
            status: status,
            scheduledTime: medicineTime,
            streak: newStreak,
            completed: todayEntry.completed,
            dueTodayCount: dueToday.length,
            takenCount: takenToday
        });

    } catch (err) {
        console.error("Error in finishMeds:", err);
        res.status(500).json({ error: "Server error" });
    }
});

app.get("/missMeds", async (req, res) => {
    try {
        const { uid, medicineName, medicineTime } = req.query;
        if (!uid || !medicineName || !medicineTime) {
            return res.status(400).json({ error: "uid, medicineName, and medicineTime required" });
        }

        const db = client.db(dbName);
        const user = await db.collection(collectionName).findOne({ uid });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // SERVER TIME (Hong Kong)
        const hkNow = getHKT();
        const today = getHKTDateOnly();

        // Find medicine
        const medicine = user.medicine?.find(m => m.name === medicineName);
        if (!medicine?.time?.length) {
            return res.status(404).json({ error: "Medicine not found" });
        }
        if (!medicine.time.includes(medicineTime)) {
            return res.status(400).json({ error: `medicineTime "${medicineTime}" not in schedule for ${medicineName}` });
        }

        // ================
        // Record as MISSED
        // ================
        const status = "missed";

        // Update streakHistory
        const streakHistory = user.streakHistory || [];
        const todayEntry = streakHistory.find(e => e.date === today) || {
            date: today,
            medicines: [],
            completed: false
        };
        if (!streakHistory.find(e => e.date === today)) {
            streakHistory.unshift(todayEntry);
        }

        todayEntry.medicines = todayEntry.medicines
            .filter(d => !(d.name === medicineName && d.time === medicineTime))
            .concat([{
                name: medicineName,
                time: medicineTime,
                status,
                timestamp: hkNow,
                within30Min: false   // explicitly not within 30 min
            }]);

        // Recalculate streak
        const allDoses = user.medicine.flatMap(m => m.time.map(t => ({ name: m.name, time: t })));
        const takenToday = todayEntry.medicines.filter(d => d.status === "taken" && d.within30Min).length;
        todayEntry.completed = takenToday === allDoses.length;
        const newStreak = todayEntry.completed ? (user.streak || 0) + 1 : user.streak;

        await db.collection(collectionName).updateOne(
            { uid },
            { $set: { streakHistory, streak: newStreak, lastUpdate: hkNow } }
        );

        res.json({
            status: "missed",
            scheduledTime: medicineTime,
            streak: newStreak,
            completed: todayEntry.completed
        });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

//health report
app.post("/saveHealthData/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const { weight, height, glucose, systolic, diastolic, heartRate } = req.body;
    
    const db = client.db(dbName);
    const today = getHKTDateOnly();

    // 1. Prepare the new data points
    const newEntries = {
      weight: weight ? { date: today, value: parseFloat(weight) } : null,
      glucose: glucose ? { date: today, value: parseFloat(glucose) } : null,
      systolic: systolic ? { date: today, value: parseInt(systolic) } : null,
      diastolic: diastolic ? { date: today, value: parseInt(diastolic) } : null,
      heartRate: heartRate ? { date: today, value: parseInt(heartRate) } : null,
    };

    // 2. Build the Update Pipeline
    // We use $filter to remove existing entries with today's date, then $concatArrays to add the new one
    const pipeline = [
      {
        $set: {
          uid: uid, // Ensure uid exists on upsert
          lastHealthUpdate: getHKT(),
          height: height ? parseFloat(height) : "$height", // Keep old height if not provided
          // Repeat this logic for every array field
          ...Object.keys(newEntries).reduce((acc, key) => {
            if (newEntries[key]) {
              acc[key] = {
                $concatArrays: [
                  {
                    $filter: {
                      input: { $ifNull: [`$${key}`, []] },
                      as: "item",
                      cond: { $ne: ["$$item.date", today] }
                    }
                  },
                  [newEntries[key]]
                ]
              };
            }
            return acc;
          }, {})
        }
      }
    ];

    const result = await db.collection("healthReport").updateOne(
      { uid },
      pipeline,
      { upsert: true }
    );

    res.json({ 
      success: true, 
      message: "Health data updated (one entry per day enforced)", 
      date: today 
    });
  } catch (err) {
    console.error("saveHealthData error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

app.get("/healthReport/:uid", async (req, res) => {
    try {
        const db = client.db(dbName);
        const uid = req.params.uid;

        const report = await db.collection("healthReport").findOne({ uid: uid });

        if (!report) {
            return res.status(404).json({ error: "Report not found" });
        }

        res.status(200).json(report);

    } catch (err) {
        console.error("Data fetch error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
})


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

//Debug
//Debug
//Debug
//Debug
//Debug
//Debug
//Debug
//Debug
//Debug
//Debug
//Debug ONLY

//DELETE medicine from medicine[] + ALL streakHistory entries
app.get("/debug/deleteMedicine", async (req, res) => {
    try {
        const { uid, medicineName } = req.query;
        console.log(`🗑️ DEBUG DELETE: uid=${uid}, medicine=${medicineName}`);

        if (!uid || !medicineName) {
            return res.status(400).json({ error: "uid and medicineName required" });
        }

        const db = client.db(dbName);
        const user = await db.collection(collectionName).findOne({ uid: uid });
        if (!user) {
            console.log(`User ${uid} not found`);
            return res.status(404).json({ error: "User not found" });
        }

        console.log(`BEFORE: ${user.medicine?.length || 0} medicines, streak=${user.streak}`);

        // 1. DELETE from medicine array
        await db.collection(collectionName).updateOne(
            { uid: uid },
            { $pull: { medicine: { name: medicineName } } }
        );

        // 2. Clean ALL streakHistory entries for this medicine
        const updatedUser = await db.collection(collectionName).findOne({ uid: uid });
        const cleanedHistory = (updatedUser.streakHistory || []).map(day => ({
            ...day,
            medicines: day.medicines.filter(dose => dose.name !== medicineName)
        }));

        // Recalculate streak
        const newStreak = cleanedHistory.filter(day => day.completed).length;

        await db.collection(collectionName).updateOne(
            { uid: uid },
            {
                $set: {
                    streakHistory: cleanedHistory,
                    streak: newStreak
                }
            }
        );

        console.log(` AFTER: Medicines left=${updatedUser.medicine?.length - 1 || 0}, New streak=${newStreak}`);

        res.json({
            debug: true,
            message: `🗑️ "${medicineName}" DELETED from medicine[] + streakHistory`,
            medicinesLeft: updatedUser.medicine?.length - 1 || 0,
            newStreak: newStreak,
            cleanedDays: cleanedHistory.length
        });

    } catch (err) {
        console.error("DEBUG delete error:", err);
        res.status(500).json({ error: "Debug delete failed" });
    }
});



//port
app.listen(process.env.PORT || 8099);

