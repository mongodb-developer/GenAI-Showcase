import argparse

from app.db import get_database
from app.demo_data import seed_demo_data


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the ambient inventory demo.")
    parser.add_argument(
        "--reset", action="store_true", help="Drop and recreate demo collections."
    )
    args = parser.parse_args()

    db = get_database()
    seed_demo_data(db, reset=args.reset)
    print(f"Seeded database: {db.name}")


if __name__ == "__main__":
    main()
