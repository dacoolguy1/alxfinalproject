// app.js
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const flash = require('express-flash'); // Add this line


const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: 'your-secret-key', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
// Set the DEBUG environment variable
process.env.DEBUG = 'express:*';

// Initialize SQLite database
const db = new sqlite3.Database('./database.sqlite');

// Passport local strategy for user login
passport.use(new LocalStrategy(
  (username, password, done) => {
    db.get('SELECT * FROM users WHERE username = ?', username, (err, user) => {
      if (err) return done(err);
      if (!user) return done(null, false, { message: 'Incorrect username.' });
      if (!bcrypt.compareSync(password, user.password)) return done(null, false, { message: 'Incorrect password.' });
      return done(null, user);
    });
  }
));

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  db.get('SELECT * FROM users WHERE id = ?', id, (err, user) => {
    if (err) return done(err);
    done(null, user);
  });
});
// const express = require('express');
// const app = express();
// const port = process.env.PORT || 3000;

// Serve static files from the "public" directory
app.use(express.static(__dirname + '/public'));

// Set up EJS as the view engine
app.set('view engine', 'ejs');

// Define a route for the homepage
app.get('/', (req, res) => {
    res.render('homepage');
});

app.get('/register', (req, res) => {
    res.render('register');
})
// app.get('/dashboard', (req, res) => {
//     res.render("dashboard");
// })
// Registration route

// app.post('/register', (req, res) => {
//     const { username, password } = req.body;
//     const salt = bcrypt.genSaltSync(10);
//     const hashedPassword = bcrypt.hashSync(password, salt);
//     // const hashedPassword = bcrypt.hashSync(password, 10);
  
//     db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
//       if (err) {
//         return res.status(500).json({ message: 'Registration failed.' });
//       }
//       return res.status(201).json({ message: 'Registration successful.' });
//     });
//   });
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Check if the username already exists in the database
    db.get('SELECT * FROM users WHERE username = ?', username, (err, existingUser) => {
        if (err) {
            console.error('Error checking username:', err);
            req.flash('error', 'Error checking username.')
            return res.status(500).json({ message: 'Error checking username.' });
        }

        if (existingUser) {
            // Username already exists, send an error message
            req.flash('error', 'Username already exists.')
            return res.render("register");
                   
            // return res.status(400).json({ message: 'Username already exists.' });
        }

        // Generate a salt
        const saltRounds = 10; // Adjust the number of rounds as needed
        bcrypt.genSalt(saltRounds, (err, salt) => {
            if (err) {
                console.error('Error generating salt:', err);
                return res.status(500).json({ message: 'Registration gensalt failed.' });
            }

            console.log('Generated salt:', salt);

            // Hash the password with the generated salt
            bcrypt.hash(password, salt, (err, hashedPassword) => {
                if (err) {
                    console.error('Error hashing password:', err);
                    req.flash('error', 'Error hashing password.')
                    return res.status(500).json({ message: 'Registration hash failed.', err });
                }

                console.log('Hashed password:', hashedPassword);

                // Insert the new user into the database
                db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
                    if (err) {
                        console.error('Error inserting into database:', err);
                        req.flash('error', 'Registeration Unsuncessful.')
                        return res.status(500).json({ message: 'Registration insertion failed.' });
                    }
                    return res.render("homepage");
                    // return res.status(201).json({ message: 'Registration successful.' });
                });
            });
        });
    });
});

  // Login route
  app.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/register',
    failureFlash: true,
  }));
  app.get('/login', (req, res) => {
    res.render("homepage")
  })
  // Logout route
  // Logout route
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Error logging out:', err);
            req.flash('error', 'Error logging out.');
        }
        res.redirect('/');
    });
});

//   app.get('/logout', (req, res) => {
//     req.logout();
//     res.redirect('/');
//   });
  
  // Ensure authentication for certain routes
  function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
  }
  
  // Protected route example
  // Updated dashboard route to fetch and pass tasks to the template
app.get('/dashboard', ensureAuthenticated, (req, res) => {
    const userId = req.user.id; // Get the user ID from the authenticated user

    // Fetch tasks associated with the user from the database
    db.all('SELECT * FROM tasks WHERE user_id = ?', [userId], (err, tasks) => {
        if (err) {
            console.error('Error fetching tasks:', err);
            req.flash('error', 'Error fetching tasks.');
            return res.redirect('/dashboard'); // Redirect to dashboard with an error message
        }

        // Render the dashboard view with the retrieved tasks
        res.render('dashboard', { user: req.user, tasks: tasks }); // Pass the tasks data to the template
    });
});

  // Create a new task
app.post('/tasks/create', ensureAuthenticated, (req, res) => {
    const { taskName, dueDate } = req.body;
    const userId = req.user.id; // Get the user ID from the authenticated user

    db.run('INSERT INTO tasks (user_id, name, due_date) VALUES (?, ?, ?)', [userId, taskName, dueDate], (err) => {
        if (err) {
            console.error('Error creating task:', err);
            req.flash('error', 'Error creating task.');
            return res.redirect('/dashboard'); // Redirect to dashboard or display an error message
        }
        req.flash('success', 'Task created successfully.');
        res.redirect('/dashboard'); // Redirect to the dashboard or display a success message
    });
});

// Update a task (e.g., change name or due date)
app.post('/tasks/update/:id', ensureAuthenticated, (req, res) => {
    const { newName, newDueDate } = req.body;
    const taskId = req.params.id;

    db.run('UPDATE tasks SET name = ?, due_date = ? WHERE id = ?', [newName, newDueDate, taskId], (err) => {
        if (err) {
            console.error('Error updating task:', err);
            req.flash('error', 'Error updating task.');
        } else {
            req.flash('success', 'Task updated successfully.');
        }
        res.redirect('/dashboard'); // Redirect to the dashboard or display a success/error message
    });
});

// Mark a task as completed
app.post('/tasks/complete/:id', ensureAuthenticated, (req, res) => {
    const taskId = req.params.id;

    db.run('UPDATE tasks SET completed = 1 WHERE id = ?', [taskId], (err) => {
        if (err) {
            console.error('Error marking task as completed:', err);
            req.flash('error', 'Error marking task as completed.');
        } else {
            req.flash('success', 'Task marked as completed.');
        }
        res.redirect('/dashboard'); // Redirect to the dashboard or display a success/error message
    });
});
// ...

// Delete a task
app.post('/tasks/delete/:id', ensureAuthenticated, (req, res) => {
    const taskId = req.params.id;

    db.run('DELETE FROM tasks WHERE id = ?', [taskId], (err) => {
        if (err) {
            console.error('Error deleting task:', err);
            req.flash('error', 'Error deleting task.');
        } else {
            req.flash('success', 'Task deleted successfully.');
        }
        res.redirect('/dashboard'); // Redirect to the dashboard or display a success/error message
    });
});

// ...

  
app.listen(port, () => {
    
    console.log(`Server is running on port ${port}`);
});
