import logging

def get_logger(name: str = "ollama-app") -> logging.Logger:
    logger = logging.getLogger(name)

    if not logger.handlers:
        # Formatter with timestamp, log level, and message
        formatter = logging.Formatter(
            "[%(asctime)s] [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )

        # Console handler
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)

        # Attach handler if not already attached
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)  # Change to INFO or WARNING in production

    return logger
