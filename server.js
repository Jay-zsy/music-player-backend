require("dotenv").config();
const express = require("express"); // Express web server framework
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
const PORT = process.env.PORT || 8888; // When you build, heroku has their own port
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const cookieSession = require("cookie-session");
const cheerio = require("cheerio");
const { generateRandomString } = require("./aux/helpers");

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID; // Your spotify client id
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET; // Your spotify secret
const SPOTIFY_CALLBACK_URI = process.env.SPOTIFY_CALLBACK_URI; // Your spotify redirect uri
const GENIUS_CLIENT_ID = process.env.GENIUS_CLIENT_ID; // Your genius client id
const GENIUS_CLIENT_SECRET = process.env.GENIUS_CLIENT_SECRET; // Your genius secret
const GENIUS_CALLBACK_URI = process.env.GENIUS_CALLBACK_URI; // Your genius redirect uri
const FRONTEND_CALLBACK_URL = process.env.FRONTEND_CALLBACK_URL; // Your frontend uri
const SCOPE = process.env.SCOPE;
const KEYS = process.env.KEYS;

let stateKey = "spotify_auth_state";

let app = express();

app.use(express.json());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin,X-Requested-With,Content-Type,Accept,content-type,application/json"
  );
  next();
});

app
  .use(express.static(__dirname + "/build"))
  .use(cors())
  .use(cookieParser())
  .use(morgan("dev"));

app.get("/", (req, res) => {
  res.send("I am a teapot");
});

app.get("/api/abc", (req, res) => {
  console.log(req.headers);
  res.json({ data: "cba" });
});

app.get("/api/spotify", function (req, res) {
  let state = generateRandomString(16);
  res.cookie(stateKey, state);
  // your application requests authorization
  let scope = SCOPE;
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: SPOTIFY_CLIENT_ID,
        scope,
        redirect_uri: SPOTIFY_CALLBACK_URI,
        state,
      })
  );
});

app.get("/api/spotifycallback", function (req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter
  let code = req.query.code || null;
  let state = req.query.state || null;
  let storedState = req.cookies ? req.cookies[stateKey] : null;
  if (state === null || state !== storedState) {
    res.redirect(
      "/#" +
        querystring.stringify({
          error: "state_mismatch",
        })
    );
  } else {
    res.clearCookie(stateKey);
    const params = {
      redirect_uri: SPOTIFY_CALLBACK_URI,
      code,
      grant_type: "authorization_code",
    };
    axios({
      method: "post",
      url: "https://accounts.spotify.com/api/token",
      params,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          new Buffer.from(
            SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET
          ).toString("base64"),
      },
    })
      .then((response) => {
        const access_token = response.data.access_token;
        const refresh_token = response.data.refresh_token;
        // res.cookie("spotify_access_token", access_token);
        // res.cookie("spotify_refresh_token", refresh_token);
        res.redirect(
          FRONTEND_CALLBACK_URL +
            "/#" +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token,
            })
        );
      })
      .catch((e) => console.error(e.response.data));
  }
});

app.get("/api/refresh_token", function (req, res) {
  // requesting access token from refresh token
  let refresh_token = req.cookies.spotify_refresh_token;

  const params = {
    grant_type: "refresh_token",
    refresh_token: refresh_token,
  };

  axios({
    method: "post",
    url: "https://accounts.spotify.com/api/token",
    params,
    headers: {
      Authorization:
        "Basic " +
        new Buffer.from(
          SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET
        ).toString("base64"),
    },
  })
    .then((response) => {
      // console.log("this is the response data from spotify: ", response.data);
      let access_token = response.data.access_token;
      res.cookie("spotify_access_token", access_token);

      res.status(204).json({ spotify_access_token: access_token });
    })
    .catch((e) => {
      console.log(e);
    });
});

console.log("Listening on 8888");
app.listen(PORT);
