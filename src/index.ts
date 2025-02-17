import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import logger from './utils/logger';
import middleware from './utils/middleware';
import config from './utils/config';
import userRoutes from './routes/userRoutes';
import storeRoutes from './routes/storeRoutes';
import productRoutes from './routes/productRoutes';

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(logger);

app.use('/api/users', userRoutes);
app.use('/api/stores', middleware.tokenExtractor, middleware.authenticateToken, storeRoutes);
app.use('/api/products', productRoutes);

app.use(middleware.errorHandler, middleware.requestLogger);

app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});
