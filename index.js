import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postPath = path.join(__dirname, 'data', 'posts.json');
const port = 3001;
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());
const SECRET_KEY = "This is a Badass Website and it was developed by a Queen";
app.use(session({
    secret: "This is a Badass Website and it was developed by a Queen",
    saveUninitialized: true,
    resave: false
}));

/* Check for valid email id */
function isEmailValid(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/* JWT Middleware */
function authenticationToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).send("Access Denied");
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).send("Unauthorized");
        }
        req.user = decoded;
        next();
    });
}

/* Getting the Post Data */
function getPosts() {
    if (!fs.existsSync(postPath)) {
        fs.writeFileSync(postPath, JSON.stringify([]));
    }
    const pathFile = fs.readFileSync(postPath, 'utf-8');
    if (pathFile.trim() === "") {
        return [];
    }
    return JSON.parse(pathFile);
}

app.get('/search', (req, res) => {
    const { query, category } = req.query;
    const posts = getPosts();

    let filteredPosts;

    if (!category) {
        // Search in all categories
        filteredPosts = posts.filter(post => {
            const foodNameMatch = post.foodName && post.foodName.toLowerCase().includes(query.toLowerCase());
            const restaurantMatch = post.resturant && post.resturant.toLowerCase().includes(query.toLowerCase());
            const authorMatch = post.author && post.author.toLowerCase().includes(query.toLowerCase());
            return foodNameMatch || restaurantMatch || authorMatch;
        });
    } else {
        // Search in the specified category
        filteredPosts = posts.filter(post => {
            const postCategoryValue = post[category];
            return postCategoryValue && postCategoryValue.toLowerCase().includes(query.toLowerCase());
        });
    }

    res.render('Post.ejs', { post: filteredPosts });
});


app.get('/post/authoredit', authenticationToken, (req, res) => {
    const { username, email } = req.user;
    const FoodName = req.query.foodName; // Use req.query for GET requests
    let posts = getPosts();
    
    const postToEdit = posts.find(post => post.foodName === FoodName && post.author === username && post.email === email);
    if (!postToEdit) {
        return res.redirect('/post?error=Only author can Edit the post');
    }
    
    res.render('EditForm.ejs', { post: postToEdit });
});


app.post('/post/edit', authenticationToken, (req, res) => {
    const { username, email } = req.user;
    const { foodName, resturant, content } = req.body;
    let posts = getPosts();
    
    const index = posts.findIndex(post => post.foodName === foodName && post.author === username && post.email === email);
    if (index === -1) {
        return res.redirect('/post?error=Post not found or unauthorized');
    }
    
    // Update the post
    posts[index] = { ...posts[index], resturant, content };
    fs.writeFileSync(postPath, JSON.stringify(posts, null, 2));
    
    res.redirect('/post?message=Post updated successfully');
});





/* Adding a New Post */
function addPost(newPost) {
    const posts = getPosts();
    posts.push({
        foodName: newPost.foodName,
        resturant: newPost.resturant,
        content: newPost.content,
        author:newPost.author,
        date:newPost.date,
        email:newPost.email
    });
    fs.writeFileSync(postPath, JSON.stringify(posts, null, 2));
}

/* Logging Routes */

app.get('/login', (req, res) => {
    res.render("login.ejs");
});


/* JWT Token */
app.post('/login', (req, res) => {
    const { username, email } = req.body;
    if (!isEmailValid(email)) {
        return res.status(401).send({ message: "Invalid Email" });
    }
    const token = jwt.sign({ username, email }, SECRET_KEY);
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/");
});




/* General Routes */
app.get('/', (req, res) => {
    res.render("Home.ejs",{user:req.session.user});
});

app.get("/post/add",(req,res)=>
{
    res.render("AddPost.ejs");
})


app.get('/contact', (req, res) => {
    res.render("ContactUs.ejs");
});

app.get('/about', (req, res) => {
    res.render("AboutUs.ejs");
});

app.get('/post', (req, res) => {
    const posts = getPosts();
    res.render("Post.ejs", { post: posts });
});



/* Adding a Post */




app.post("/post/add/submit", authenticationToken, (req, res) => {
    const { username, email } = req.user;
    const newPost = {
        foodName: req.body.foodName,
        resturant: req.body.resturant,
        content: req.body.content,
        author: username,
        date: new Date().toLocaleDateString(),
        email:email
    };
    addPost(newPost);
    res.redirect('/post');
});




/*Deleting a post*/


app.post('/post/delete',authenticationToken,(req,res)=>
{   const {username,email}=req.user;
    const FoodName=req.body.foodName;
    let posts=getPosts();
    const authorize=posts.some(post=>post.foodName===FoodName && post.author===username && post.email===email );
    if (!authorize) {
        return res.redirect('/post?error=Only author can delete the post');
    }

    const index = posts.findIndex(post => post.foodName === FoodName);
    
    if (index === -1) {
        return res.redirect('/post?error=Post not found');
    }

    posts.splice(index, 1);
    
    try {
        fs.writeFileSync(postPath, JSON.stringify(posts, null, 2));
        res.redirect('/post?message=Post deleted successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/post?error=Error deleting the post try again');
    }
});
/* Logging Out */
app.get('/logout', (req, res) => {
    console.log("Logout route hit");
    res.clearCookie("token");
    req.session.destroy(err => {
        if (err) {
            console.error("Error destroying session:", err);
        }
        console.log("Session destroyed");
        res.redirect('/login');
    });
});
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});



