# Automation Interface

## How to run it?

1. Install Python and pip
2. Install the required python modules:

```bash
pip install -r requirements.txt
```
3. Create .env variable in the project root directory and put these 4 lines (Replace x with your credentials):
```.env
DB_HOST="x"
DB_PORT="x"
DB_USER="x"
DB_PASS="x"
```

4. Run the python server using terminal or powershell:
```bash
python main.py
```

5. Launch **page.html** (double clicking should be enough)

***Note**: The program heavily relies on .bat files. Before clicking buttons or doing any actions please make sure the batch scripts in batch folder have the right directory (especially any ReadyAPI / SoapUI scripts)*