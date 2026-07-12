# Agro Dashboard

An intelligent agricultural IoT analytics platform with machine learning-powered insights. This full-stack application combines a Python FastAPI backend with a modern Next.js frontend for real-time agricultural data analysis and crop health prediction.

## Features

- **AI-Powered Analytics**: Machine learning models for crop classification and prediction
- **Real-Time Data Processing**: FastAPI backend for fast data ingestion and analysis
- **Interactive Dashboard**: Modern React-based UI with Tailwind CSS styling
- **IoT Integration**: Support for agricultural IoT sensor data
- **Multiple ML Models**: Decision Tree and Naive Bayes classifiers for accuracy comparison
- **Comprehensive Metrics**: Accuracy, precision, recall, F1-score, and confusion matrix analysis

## Project Structure

```
agro-dashboard/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── cek.py                  # Utility functions
│   ├── agriculture_iot.csv     # Training data
│   ├── requirements.txt        # Python dependencies
│   └── __pycache__/           # Python cache
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js app directory
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── globals.css
│   │   └── components/        # React components
│   ├── package.json           # Node dependencies
│   ├── tsconfig.json          # TypeScript config
│   ├── tailwind.config.ts     # Tailwind CSS config
│   └── next-env.d.ts          # Next.js types
└── README.md                   # This file
```

## Technology Stack

### Backend
- **FastAPI**: Modern Python web framework for building APIs
- **Uvicorn**: ASGI server for running FastAPI
- **Pandas**: Data manipulation and analysis
- **NumPy**: Numerical computing
- **Scikit-learn**: Machine learning library

### Frontend
- **Next.js 16**: React framework with TypeScript
- **React 19**: UI library
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: React charting library for data visualization
- **Lucide React**: Icon library
- **Axios**: HTTP client

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 18+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```
   The API will be available at `http://localhost:8000`

4. Access API documentation:
   - Swagger UI: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`

4. Build for production:
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

The backend provides REST APIs for agricultural data analysis and model predictions. Key endpoints include:
- Data ingestion and processing
- Model training and evaluation
- Crop classification and prediction
- Performance metrics retrieval

See Swagger UI (`/docs`) for complete endpoint documentation.

## Machine Learning Models

- **Decision Tree Classifier**: Fast, interpretable tree-based model
- **Gaussian Naive Bayes**: Probabilistic model for crop classification
- Models are trained on agricultural IoT sensor data including:
  - Plant height rate
  - Leaf area
  - Dry matter and vegetative growth
  - Root diameter
  - Additional IoT sensor readings

## Data Format

The system processes agricultural IoT CSV data with the following structure:
- Features: Various agricultural and environmental measurements
- Target: Crop classification or health status
- Data normalization and preprocessing included

## Development

### Running Both Services

In development, you may want to run both services concurrently:

**Terminal 1 - Backend**:
```bash
cd backend
python main.py
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or suggestions, please open an issue on the project repository.