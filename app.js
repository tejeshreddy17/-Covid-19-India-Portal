const express = require("express");

const byCrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const path = require("path");

const { open } = require("sqlite");

const sqlite3 = require("sqlite3");

const filepath = path.join(__dirname, "twitterClone.db");

//////initializing Db and server
let databasehandler = null;

const initializingDbandServer = async () => {
  try {
    databasehandler = await open({
      filename: filepath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server listening at port 3000");
    });
  } catch (error) {
    console.log("Error at initializing sever");
    process.exit(1);
  }
};
initializingDbandServer();

const loggerFunction = (request, response, next) => {
  let jwttoken;

  const athheader = request.headers["authorization"];
  if (athheader !== undefined) {
    jwttoken = athheader.split(" ")[1];
  }

  if (jwttoken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwttoken, "my_secret_token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
////API-1
app.post("/register/", async (request, response) => {
  try {
    const { username, password, name, gender } = request.body;
    const checkingUserQuery = `
    select * 
    from user 
    where username = "${username}";`;
    const checkedUser = await databasehandler.get(checkingUserQuery);
    if (checkedUser === undefined) {
      if (password.length < 6) {
        response.status(400);
        response.send("Password is too short");
      } else {
        const hashedpassword = await byCrypt.hash(password, 10);
        const registeringQuery = `
            insert into user(username,password,name,gender)
            values
            ("${username}","${hashedpassword}","${name}","${gender}");

        `;
        console.log(registeringQuery);
        await databasehandler.run(registeringQuery);
        response.send("User created successfully");
      }
    } else {
      response.status(400);
      response.send("User already exists");
    }
  } catch (error) {
    console.log(`error at api-1 ${error.message}`);
  }
});

////api-2
app.post("/login/", async (request, response) => {
  try {
    const { username, password } = request.body;
    const checkingUserQuery = `select * from user where username = "${username}";`;
    const checkedUser = await databasehandler.get(checkingUserQuery);

    if (checkedUser === undefined) {
      response.status(400);
      response.send("Invalid user");
    } else {
      const isPasswordMatched = await byCrypt.compare(
        password,
        checkedUser.password
      );
      if (!isPasswordMatched) {
        response.status(400);
        response.send("Invalid password");
      } else {
        const payload = { username: username };

        const jwtToken = await jwt.sign(payload, "my_secret_token");
        response.send({ jwtToken });
      }
    }
  } catch (error) {
    console.log(`error at api-1 ${error.message}`);
  }
});
//////////API-3
app.get("/user/tweets/feed/", loggerFunction, async (request, response) => {
  try {
    const loggedUserDetailsQuery = `select * from user where username = "${request.username}"`;
    const loggedUserDetails = await databasehandler.get(loggedUserDetailsQuery);
    ////getting tweets from people whom the user follows

    const query3 = `
    select user.username as username,
    tweet.tweet as tweet,
    tweet.date_time as dateTime
    from (tweet inner join follower
    on tweet.user_id = follower.following_user_id) as combo_table
    inner join user
    on combo_table.following_user_id = user.user_id
    where follower.follower_user_id = ${loggedUserDetails.user_id}
    order by tweet.date_time desc
    limit 4 offset 0;
    `;
    const tweet_array = await databasehandler.all(query3);

    response.send(tweet_array);
  } catch (error) {
    console.log(`error at api-3${error.message}`);
  }
});

////API-4
app.get("/user/following/", loggerFunction, async (request, response) => {
  try {
    const loggedUserDetailsQuery = `select * from user where username = "${request.username}"`;
    const loggedUserDetails = await databasehandler.get(loggedUserDetailsQuery);
    ////getting list of all names whom the user follows
    const query3 = `
    select distinct user.name
    from user inner join follower
    on user.user_id = follower.following_user_id
    where follower.follower_user_id = ${loggedUserDetails.user_id}
    `;
    const tweet_array = await databasehandler.all(query3);
    response.send(tweet_array);
  } catch (error) {
    console.log(`error at api-4${error.message}`);
  }
});

/////API-5
app.get("/user/followers/", loggerFunction, async (request, response) => {
  try {
    const loggedUserDetailsQuery = `select * from user where username = "${request.username}"`;
    const loggedUserDetails = await databasehandler.get(loggedUserDetailsQuery);
    ////Returns the list of all names of people who follows the user
    const query3 = `
    select distinct user.name
    from user inner join follower
    on user.user_id = follower.follower_user_id
    where follower.following_user_id = ${loggedUserDetails.user_id}
    `;
    const tweet_array = await databasehandler.all(query3);
    response.send(tweet_array);
  } catch (error) {
    console.log(`error at api-5${error.message}`);
  }
});
////////api-6
app.get("/tweets/:tweetId/", loggerFunction, async (request, response) => {
  try {
    const loggedUserDetailsQuery = `select * from user where username = "${request.username}"`;
    const loggedUserDetails = await databasehandler.get(loggedUserDetailsQuery);
    const { tweetId } = request.params;
    const checking_query = `
        select following_user_id

        from user inner join follower
        on follower.follower_user_id = user.user_id
        WHERE user_id = ${loggedUserDetails.user_id}


        INTERSECT

        select following_user_id
        from tweet inner join follower
        on tweet.user_id = follower.following_user_id
        WHERE tweet_id = ${tweetId} ;
            
      
      `;
    const followers = await databasehandler.get(checking_query);

    if (followers === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const tweets = `
      select 
            tweet.tweet,
            count(distinct like.like_id) as likes,
            count(distinct reply.reply) as replies,
            tweet.date_time as dateTime
            
      from (tweet inner join like
      on tweet.tweet_id = like.tweet_id) as table_1
      inner join reply
      on table_1.tweet_id = reply.tweet_id
      where tweet.tweet_id = ${tweetId};
    `;
      //console.log(tweets);
      const array = await databasehandler.get(tweets);
      response.send(array);
    }
  } catch (error) {
    console.log(`error at api-6 ${error.message}e`);
  }
});
/////////api-7
app.get(
  "/tweets/:tweetId/likes/",
  loggerFunction,
  async (request, response) => {
    try {
      const loggedUserDetailsQuery = `select * from user where username = "${request.username}"`;
      const loggedUserDetails = await databasehandler.get(
        loggedUserDetailsQuery
      );
      const { tweetId } = request.params;
      ///finding whether user request the tweet_id of his following users
      const checking_query = `
        select following_user_id

        from user inner join follower
        on follower.follower_user_id = user.user_id
        WHERE user_id = ${loggedUserDetails.user_id}


        INTERSECT

        select following_user_id
        from tweet inner join follower
        on tweet.user_id = follower.following_user_id
        WHERE tweet_id = ${tweetId} ;
            
      
      `;
      const followers = await databasehandler.get(checking_query);
      if (followers === undefined) {
        response.status(401);
        response.send("Invalid Request");
      } else {
        const query7 = `
          select 
            user.username as name
        from 
            (tweet inner join like
            on tweet.tweet_id = like.tweet_id) as table_1
            inner join user
            on like.user_id = user.user_id
        where tweet.tweet_id = ${tweetId} ;
          `;
        const tweetsarray = await databasehandler.all(query7);
        console.log(tweetsarray);
        const required_form = tweetsarray.map((eachobject) => eachobject.name);
        response.send({ likes: required_form });
      }
    } catch (error) {
      console.log(`error at api-7 ${error.message}`);
    }
  }
);
////////api-8
app.get(
  "/tweets/:tweetId/replies/",
  loggerFunction,
  async (request, response) => {
    try {
      const loggedUserDetailsQuery = `select * from user where username = "${request.username}"`;
      const loggedUserDetails = await databasehandler.get(
        loggedUserDetailsQuery
      );
      const { tweetId } = request.params;
      ///finding whether user request the tweet_id of his following users
      const checking_query = `
        select following_user_id

        from user inner join follower
        on follower.follower_user_id = user.user_id
        WHERE user_id = ${loggedUserDetails.user_id}


        INTERSECT

        select following_user_id
        from tweet inner join follower
        on tweet.user_id = follower.following_user_id
        WHERE tweet_id = ${tweetId} ;
            
      
      `;
      const followers = await databasehandler.get(checking_query);
      if (followers === undefined) {
        response.status(401);
        response.send("Invalid Request");
      } else {
        const query8 = `
          select 
            user.name as name,
            reply
        from 
            (tweet inner join reply
            on tweet.tweet_id = reply.tweet_id) as table_1
            inner join user
            on reply.user_id = user.user_id
        where tweet.tweet_id = ${tweetId};
          `;
        const tweetsarray = await databasehandler.all(query8);
        console.log(tweetsarray);
        const required_form = tweetsarray.map((eachobject) => eachobject);
        response.send({ replies: required_form });
      }
    } catch (error) {
      console.log(`error at api-8 ${error.message}`);
    }
  }
);
/////api-9
app.get("/user/tweets/", loggerFunction, async (request, response) => {
  try {
    const loggedUserDetailsQuery = `select * from user where username = "${request.username}"`;
    const loggedUserDetails = await databasehandler.get(loggedUserDetailsQuery);
    const query9 = `
    select 
        tweet,
        count(like_id) as likes,
        count(distinct reply) as replies,
        tweet.date_time as dateTime
    from 
        (tweet inner join like
        on tweet.tweet_id = like.tweet_id) as table_1
        inner join reply
        on table_1.tweet_id = reply.tweet_id
    where 
        tweet.user_id = ${loggedUserDetails.user_id}
    group by tweet.tweet_id;
    `;
    const tweetsarray = await databasehandler.all(query9);
    response.send(tweetsarray);
  } catch (error) {
    console.log(`error at api-9 ${error.message}`);
  }
});
//// API -10
app.post("/user/tweets/", loggerFunction, async (request, response) => {
  try {
    const loggedUserDetailsQuery = `select * from user where username = "${request.username}"`;
    const loggedUserDetails = await databasehandler.get(loggedUserDetailsQuery);
    const { tweet } = request.body;
    const query10 = `
            insert into tweet (user_id,tweet)
            values
            (${loggedUserDetails.user_id},
            "${tweet}")
    `;
    await databasehandler.run(query10);
    response.send("Created a Tweet");
  } catch (error) {
    console.log(`error at api-10 ${error.message}`);
  }
});
///////API-11
app.delete("/tweets/:tweetId", loggerFunction, async (request, response) => {
  try {
    const loggedUserDetailsQuery = `select * from user where username = "${request.username}"`;
    const loggedUserDetails = await databasehandler.get(loggedUserDetailsQuery);
    const { tweetId } = request.params;
    const checking_query = `
            select user.user_id
            from user inner join tweet
            on user.user_id = tweet.user_id
            where tweet.tweet_id = ${tweetId} and 
            user.user_id = ${loggedUserDetails.user_id};           
      `;

    const followers = await databasehandler.get(checking_query);

    if (followers === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const query11 = `
                delete from tweet
                where tweet_id = ${tweetId}
        `;
      await databasehandler.run(query11);
      response.send("Tweet Removed");
    }
  } catch (error) {
    console.log(`error at api-11 ${error.message}`);
  }
});
module.exports = app;
