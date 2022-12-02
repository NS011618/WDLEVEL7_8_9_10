const express = require("express");
var csrf = require("tiny-csrf");
const path = require("path");
const app = express();
const { Todo, User } = require("./models");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");

// eslint-disable-next-line no-unused-vars
const todo = require("./models/todo");
//app.use()
app.use(bodyParser.json());
// eslint-disable-next-line no-undef
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("Some secret string"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));

//passport
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const flash = require("connect-flash");
app.set("views",path.join(__dirname,"views"));
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");

const saltRounds = 10;
app.use(flash());//using flash

app.use(session({
  secret:"my-super-secret-key-2172817261561562",
  cookie:{
    maxAge:24*60*60*60*1000
  }
}));


app.use(passport.initialize());
app.use(passport.session());

//using flash
app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});



passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      User.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch(() => {
          return done(null, false, { message: "Invalid Email-ID" });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("serial user in session", user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

app.set("view engine", "ejs");

app.get("/", async function (request, response) {
  response.render("index", {
    title: "Todo Application",
    csrfToken: request.csrfToken(),
  });
});

app.get(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      const loggedIn = request.user.id;
      const overDue = await Todo.overDue(loggedIn);
      const dueToday = await Todo.dueToday(loggedIn);
      const dueLater = await Todo.dueLater(loggedIn);
      const completedItems = await Todo.completedItems(loggedIn);
      if (request.accepts("html")) {
        response.render("todos", {
          title: "Ashish Todo Manager",
          overDue,
          dueToday,
          dueLater,
          completedItems,
          csrfToken: request.csrfToken(),
        });
      } else {
        response.json({
          overDue,
          dueToday,
          dueLater,
          completedItems,
        });
      }
    } catch (err) {
      console.log(err);
      return response.status(422).json(err);
    }
  }
);

app.get("/todos", async function (_request, response) {
  console.log("getting the list all Todos ...");
  

  try {
    const todos = await Todo.findAll();
    return response.json(todos);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.get(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      const todo = await Todo.findByPk(request.params.id);
      return response.json(todo);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

//signup page
app.get("/signup",async (request, response) => {
  response.render("signup", {
    title: "Sign up",
    csrfToken: request.csrfToken(),
  });
});

//users page
app.post("/users", async (request, response) => {
  if (!request.body.firstName) {
    request.flash("error", "Please enter your First Name");
    return response.redirect("/signup");
  }
  if (!request.body.email) {
    request.flash("error", "Please enter valid Email Id or enter Email ID");
    return response.redirect("/signup");
  }
  if (!request.body.password) {
    request.flash("error", "Please enter your Password");
    return response.redirect("/signup");
  }
  if (request.body.password < 8) {
    request.flash("error", "The Length of the password should be atleast 8");
    return response.redirect("/signup");
  }

  //hash password using bcrpt
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  //have to create the user here
  try {
    const user = await User.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      } else {
        response.redirect("/todos");
      }
    });
  } catch (error) {
    request.flash("error", error.message);
    return response.redirect("/signup");
  }
});

//login page details
app.get("/login", async (request, response) => {
  response.render("login", {
    title: "Login",
    csrfToken: request.csrfToken(),
  });
});

app.post("/session",passport.authenticate("local", {failureRedirect: "/login",failureFlash: true,}),(request, response) => {
    response.redirect("/todos");
  }
);

//signout page details
app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});


//app.post()
app.post(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.body.title.length < 5) {
      request.flash("error", "Title length should be atleast 5");
      return response.redirect("/todos");
    }
    if (!request.body.dueDate) {
      request.flash("error", "Please select a due date");
      return response.redirect("/todos");
    }
    try {
      await Todo.addTodo({
        title: request.body.title,
        dueDate: request.body.dueDate,
        userID: request.user.id,
      });
      return response.redirect("/todos");
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

//app.put
app.put(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    console.log("Mark Todo as completed:", request.params.id);
    const todo = await Todo.findByPk(request.params.id);
    try {
      const updatedTodo = await todo.setCompletionStatus(
        request.body.completed
      );
      return response.json(updatedTodo);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

//app.delete
app.delete(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    console.log("delete a todo with ID:", request.params.id);
    try {
      const res = await Todo.remove(request.params.id, request.user.id);
      return response.json({ success: res === 1 });
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  
  }
);

module.exports = app;
