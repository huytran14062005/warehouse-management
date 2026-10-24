"""Create the promotions table without modifying existing production data."""

from web import app, db
from web.models import Promotion


def main():
    with app.app_context():
        Promotion.__table__.create(bind=db.engine, checkfirst=True)
        print("Promotions table is ready.")


if __name__ == "__main__":
    main()
