"""
Prediction model for ENEM TRI scores using XGBoost
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import joblib
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor

try:
    from xgboost import XGBRegressor
    HAS_XGBOOST = True
except (ImportError, Exception) as e:
    HAS_XGBOOST = False
    print(f"XGBoost not available ({e}), using GradientBoostingRegressor")

from .preprocessor import ENEMPreprocessor

# Score bounds based on real school averages in database (2018-2024)
# These are NOT individual student limits — they are school average limits
SCORE_BOUNDS = {
    'nota_cn':      {'min': 300, 'max': 750},
    'nota_ch':      {'min': 280, 'max': 750},
    'nota_lc':      {'min': 280, 'max': 700},
    'nota_mt':      {'min': 300, 'max': 900},
    'nota_redacao': {'min': 0,   'max': 960},
    'nota_media':   {'min': 300, 'max': 800},
}

# The model was trained on data up to 2022 → target 2023.
# At inference, it uses the latest available data to predict the NEXT year.
MODEL_TRAINING_TARGET_YEAR = 2023


class ENEMPredictionModel:
    """Prediction model for ENEM school scores"""

    def __init__(self, model_dir: str = None):
        if model_dir is None:
            model_dir = Path(__file__).parent.parent / "models"
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(exist_ok=True)

        self.models = {}  # {target: model}
        self.feature_names = None
        self.preprocessor = None

    def _get_model(self):
        """Get the appropriate model class"""
        if HAS_XGBOOST:
            return XGBRegressor(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=42,
                n_jobs=-1
            )
        else:
            # HistGradientBoostingRegressor handles NaN natively
            return HistGradientBoostingRegressor(
                max_iter=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=42
            )

    def train(self, target: str = 'nota_media', preprocessor: ENEMPreprocessor = None) -> Dict:
        """
        Train prediction model for a specific target

        Args:
            target: Target column to predict (nota_cn, nota_ch, nota_lc, nota_mt, nota_redacao, nota_media)
            preprocessor: Optional preprocessor instance

        Returns:
            Dictionary with training metrics
        """
        if preprocessor is None:
            preprocessor = ENEMPreprocessor()
        self.preprocessor = preprocessor

        # Prepare training data
        X, y, school_ids = preprocessor.prepare_training_data(target)

        # HistGradientBoostingRegressor handles NaN natively, no need to fill

        self.feature_names = list(X.columns)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # Train model
        model = self._get_model()
        model.fit(X_train, y_train)

        # Evaluate
        y_pred_train = model.predict(X_train)
        y_pred_test = model.predict(X_test)

        metrics = {
            'target': target,
            'train_samples': len(X_train),
            'test_samples': len(X_test),
            'train_rmse': np.sqrt(mean_squared_error(y_train, y_pred_train)),
            'test_rmse': np.sqrt(mean_squared_error(y_test, y_pred_test)),
            'train_mae': mean_absolute_error(y_train, y_pred_train),
            'test_mae': mean_absolute_error(y_test, y_pred_test),
            'train_r2': r2_score(y_train, y_pred_train),
            'test_r2': r2_score(y_test, y_pred_test),
        }

        # Feature importance
        if hasattr(model, 'feature_importances_'):
            importance = pd.DataFrame({
                'feature': self.feature_names,
                'importance': model.feature_importances_
            }).sort_values('importance', ascending=False)
            metrics['feature_importance'] = importance.head(10).to_dict('records')

        # Store model
        self.models[target] = model

        # Save model
        target_short = target.replace('nota_', '')
        model_path = self.model_dir / f"prediction_{target_short}.joblib"
        joblib.dump({
            'model': model,
            'feature_names': self.feature_names,
            'metrics': metrics
        }, model_path)

        print(f"Model saved to {model_path}")
        return metrics

    def train_all(self) -> Dict[str, Dict]:
        """Train models for all TRI scores"""
        preprocessor = ENEMPreprocessor()

        targets = ['nota_cn', 'nota_ch', 'nota_lc', 'nota_mt', 'nota_redacao', 'nota_media']
        all_metrics = {}

        for target in targets:
            print(f"\n{'='*60}")
            print(f"Training model for {target}")
            print('='*60)
            metrics = self.train(target, preprocessor)
            all_metrics[target] = metrics

            print(f"  Train RMSE: {metrics['train_rmse']:.2f}")
            print(f"  Test RMSE: {metrics['test_rmse']:.2f}")
            print(f"  Test R2: {metrics['test_r2']:.3f}")

        return all_metrics

    def load_model(self, target: str) -> bool:
        """Load a trained model from disk"""
        target_short = target.replace('nota_', '')
        model_path = self.model_dir / f"prediction_{target_short}.joblib"

        if not model_path.exists():
            print(f"Model not found: {model_path}")
            return False

        data = joblib.load(model_path)
        self.models[target] = data['model']
        self.feature_names = data['feature_names']
        return True

    def load_all_models(self) -> int:
        """Load all available models"""
        targets = ['nota_cn', 'nota_ch', 'nota_lc', 'nota_mt', 'nota_redacao', 'nota_media']
        loaded = 0
        for target in targets:
            if self.load_model(target):
                loaded += 1
        return loaded

    def predict(self, codigo_inep: str, target: str = 'nota_media') -> Dict:
        """
        Predict score for a school

        Args:
            codigo_inep: School INEP code
            target: Target to predict

        Returns:
            Dictionary with prediction and confidence interval
        """
        if target not in self.models:
            if not self.load_model(target):
                raise ValueError(f"Model for {target} not available")

        if self.preprocessor is None:
            self.preprocessor = ENEMPreprocessor()

        # Get features for school
        features = self.preprocessor.prepare_features_for_school(codigo_inep)
        if features is None:
            raise ValueError(f"School {codigo_inep} not found")

        # Create feature vector
        X = pd.DataFrame([{k: features.get(k, np.nan) for k in self.feature_names}])
        X = X.fillna(X.median())

        # Predict
        model = self.models[target]
        raw_prediction = float(model.predict(X)[0])

        # Clamp prediction to real school average bounds
        bounds = SCORE_BOUNDS.get(target, {'min': 200, 'max': 900})
        prediction = max(bounds['min'], min(bounds['max'], raw_prediction))

        # Estimate confidence interval (using training RMSE as proxy)
        target_short = target.replace('nota_', '')
        model_path = self.model_dir / f"prediction_{target_short}.joblib"
        if model_path.exists():
            data = joblib.load(model_path)
            rmse = data['metrics'].get('test_rmse', 30)
        else:
            rmse = 30  # Default uncertainty

        # Clamp confidence interval to valid bounds
        ci_low = max(bounds['min'], prediction - 1.96 * rmse)
        ci_high = min(bounds['max'], prediction + 1.96 * rmse)

        return {
            'codigo_inep': codigo_inep,
            'target': target,
            'prediction': prediction,
            'confidence_interval': {
                'low': float(ci_low),
                'high': float(ci_high)
            },
            'uncertainty': float(rmse)
        }

    def predict_all_scores(self, codigo_inep: str) -> Dict:
        """
        Predict all TRI scores for a school.

        The model was trained on data ≤2022 to predict 2023.
        At inference it uses the school's latest data to predict the next year.
        The prediction represents an ESTIMATE with a margin of error (RMSE).

        Args:
            codigo_inep: School INEP code

        Returns:
            Dictionary with all predictions
        """
        targets = ['nota_cn', 'nota_ch', 'nota_lc', 'nota_mt', 'nota_redacao', 'nota_media']

        predictions = {
            'codigo_inep': codigo_inep,
            'target_year': 2025,
            'disclaimer': (
                'Estimativa baseada em modelo preditivo (R²=0.88, erro médio ~21 pontos). '
                'Não é uma garantia de resultado.'
            ),
        }
        predictions['scores'] = {}
        predictions['confidence_intervals'] = {}

        for target in targets:
            try:
                result = self.predict(codigo_inep, target)
                target_short = target.replace('nota_', '')
                predictions['scores'][target_short] = result['prediction']
                predictions['confidence_intervals'][target_short] = result['confidence_interval']
            except Exception as e:
                print(f"Error predicting {target}: {e}")
                continue

        if not predictions['scores']:
            predictions['error'] = (
                'Dados insuficientes para gerar um prediction assertivo para esta escola. '
                'A escola pode não ter histórico suficiente no ENEM.'
            )

        return predictions

    def get_feature_importance(self, target: str = 'nota_media') -> List[Dict]:
        """Get feature importance for a model"""
        target_short = target.replace('nota_', '')
        model_path = self.model_dir / f"prediction_{target_short}.joblib"

        if not model_path.exists():
            return []

        data = joblib.load(model_path)
        return data['metrics'].get('feature_importance', [])


if __name__ == "__main__":
    # Train all models
    model = ENEMPredictionModel()
    metrics = model.train_all()

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for target, m in metrics.items():
        print(f"{target}: RMSE={m['test_rmse']:.2f}, R2={m['test_r2']:.3f}")

    # Test prediction
    print("\n" + "="*60)
    print("TEST PREDICTION")
    print("="*60)
    test_school = "21009902"  # Example school
    predictions = model.predict_all_scores(test_school)
    print(f"Predictions for {test_school}:")
    for score, value in predictions['scores'].items():
        print(f"  {score}: {value:.2f}")
