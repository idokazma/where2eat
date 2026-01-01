"""
Setup configuration for Where2Eat Restaurant Discovery System
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="where2eat",
    version="1.0.0",
    author="Where2Eat Team",
    author_email="team@where2eat.com",
    description="Intelligent restaurant discovery system from YouTube podcasts",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/where2eat",
    packages=find_packages(include=['src', 'src.*']),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.9",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=22.0.0",
            "ruff>=0.0.200",
            "mypy>=1.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "where2eat=scripts.main:main",
        ],
    },
    include_package_data=True,
    package_data={
        "src": ["*.py"],
    },
)