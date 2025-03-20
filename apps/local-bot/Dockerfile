FROM python:3.12
WORKDIR /opt/app
ADD requirements.txt .
RUN pip install -r requirements.txt
ADD app.py .

CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
