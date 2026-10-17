require('dotenv').config();
const express = require('express');
var cors = require('cors');

const app = express();
const port = process.env.APP_PORT;

app.use(express.urlencoded({ extended: true}));
app.use(express.json());
app.use(cors());

// -- Main and Routes

const userRoutes = require('./modules/user_ops');
const adminRoutes = require('./modules/admin_ops');
const forecastRoutes = require('./modules/weather_ops');

app.get('/', (_req, res) => {
    res.send('Welcome to the Weather Forecast API!');
});

app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/forecast', forecastRoutes);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});