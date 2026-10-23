import bcrypt


BCRYPT_ROUNDS = 12


def hash_password(raw_password):
    password_bytes = str(raw_password).encode("utf-8")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(raw_password, password_hash):
    if raw_password is None or password_hash is None:
        return False

    try:
        return bcrypt.checkpw(
            str(raw_password).encode("utf-8"),
            str(password_hash).encode("utf-8"),
        )
    except (TypeError, ValueError):
        return False
