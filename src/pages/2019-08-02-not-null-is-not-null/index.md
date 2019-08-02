---
title: "NOT NULL is NOT NULL"
date: "2019-08-02"
tags: [mysql]
---

Recently I learned that MySQL 5.6 is so "nice" that it can provide default values for columns that have `NOT NULL` constrain when values for these columns are missing during insertion.

<!-- end -->

This feature is called [Implicit Defaults](https://dev.mysql.com/doc/refman/5.6/en/data-type-defaults.html#data-types-defaults-implicit). Below is a complete example which shows this feature:

```shell
> docker run --name some-mysql -e MYSQL_ROOT_PASSWORD=root -d mysql:5.6
> docker exec -it some-mysql bash

# mysql -u root -p
Enter password:

mysql> CREATE DATABASE test;
Query OK, 1 row affected (0.01 sec)

mysql> use test;
Database changed
mysql> CREATE TABLE MY_DATA (id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    -> name VARCHAR(10) NOT NULL,
    -> value INT NOT NULL);
Query OK, 0 rows affected (0.05 sec)

mysql> INSERT INTO MY_DATA (name, value) VALUES ('a', 1);
Query OK, 1 row affected (0.04 sec)

mysql> INSERT INTO MY_DATA (name) VALUES ('c');
Query OK, 1 row affected, 1 warning (0.01 sec)

mysql> SELECT * FROM MY_DATA;
+----+------+-------+
| id | name | value |
+----+------+-------+
|  1 | a    |     1 |
|  2 | c    |     0 |
+----+------+-------+
2 rows in set (0.04 sec)
```

Base on the linked documentation for implicit defaults our database server has got **strict mode disabled by default**. What is strict mode? 

> Strict mode controls how MySQL handles invalid or missing values in data-change statements such as INSERT or UPDATE. 
> Source: https://dev.mysql.com/doc/refman/5.6/en/sql-mode.html#sql-mode-strict#sql-mode-strict

If we will repeat above code snipped with a more recent version of MySQL like 8 were **strict mode is enabled by default** then last insert command won't work.

```shell
> docker run --name some-mysql -e MYSQL_ROOT_PASSWORD=root -d mysql:8

...

mysql> INSERT INTO MY_DATA (name) VALUES ('c');
ERROR 1364 (HY000): Field 'value' doesn't have a default value
```

## Conclusion

When you work with MySQL and use a different version of the software make yourself a favour and check what SQL mode(s) are set on the environment with which you start to work. This can be done with single SQL command:

```sql
SELECT @@GLOBAL.sql_mode;

```

and then invest few minutest to learn how enabled modes affect the SQL syntax MySQL supports and how data validation checks are performed. You can find a full list of SQL modes [here](https://dev.mysql.com/doc/refman/5.6/en/sql-mode.html#sql-mode-full). 

So that you won't have to spend a few hours figuring out why some of your e2e tests doesn't work only on one environment!