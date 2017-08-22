import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles, createStyleSheet } from 'material-ui/styles';
import List, { ListItem, ListItemIcon, ListItemText } from 'material-ui/List';

import Snackbar from 'material-ui/Snackbar';

import IconButton from 'material-ui/IconButton';
import CloseIcon from 'material-ui-icons/Close';

import FolderIcon from 'material-ui-icons/Folder';
import FolderIconOpen from 'material-ui-icons/FolderOpen';
import VisibilityIcon from 'material-ui-icons/Visibility';
import VisibilityOffIcon from 'material-ui-icons/VisibilityOff';
import indigo from 'material-ui/colors/indigo';

import axios from 'axios';

let lib = require("../utils/library.js");


class DbSchema extends Component {
	constructor(props) {
		super(props);
		this.state = {
			dbIndex: props.dbIndex,
			table: props.table,
			dbSchema: null,
			leftPaneVisibility: props.leftPaneVisibility,
			url: lib.getDbConfig(props.dbIndex, "url"),
			tables: [],
			snackBarVisibility: false,
			snackBarMessage: "Unknown error"
		};
	}

	componentDidMount() {
		// Save the database schema to state for future access
		if (this.state.url) {
			this.getDbSchema(this.state.url);
		}
	}

	componentWillReceiveProps(newProps) {
		this.setState({
			dbIndex: newProps.dbIndex,
			leftPaneVisibility: newProps.leftPaneVisibility,
			table: newProps.table
		});
		
		if (this.state.dbIndex !== newProps.dbIndex) {
			let newDbIndex = newProps.dbIndex;
			this.setState({
				dbIndex: newDbIndex,
				table: "",
				url: lib.getDbConfig(newDbIndex, "url"),
				tables: []
			}, function() {
				this.props.changeTable(this.state.table);
				this.props.changeColumns(this.state[this.state.table]);
				this.props.changeDbIndex(this.state.dbIndex);
				this.getDbSchema();
				this.updateVisibleColumns();
			});
		}
	}


	////////////////////////////////////////////////////////////////////////////////////////////////////
	// HTTP Methods
	////////////////////////////////////////////////////////////////////////////////////////////////////

	// Returns a list of tables from URL
	getDbSchema(url = this.state.url) {
		axios.get(url + "/", { params: {} })
			.then((response) => {
				// Save the raw resp + parse tables and columns...
				this.setState({
					dbSchema: response.data
				}, () => {
					this.parseDbSchema(this.state.dbSchema);
				});
			})
			.catch((error) => {
				// Show error in top-right Snack-Bar
				this.setState({
					snackBarVisibility: true,
					snackBarMessage: "Database does not exist."
				}, () => {
					this.timer = setTimeout(() => {
						this.setState({
							snackBarVisibility: false,
							snackBarMessage: "Unknown error"
						});
					}, 5000);
				});
			});
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Parsing Methods
	////////////////////////////////////////////////////////////////////////////////////////////////////

	// From the JSON resp, extract the names of db TABLES and update state
	parseDbSchema(data = this.state.dbSchema) {
		let dbTables = [];
		for (let i in data.definitions) {
			if (lib.getTableConfig(this.state.dbIndex, i, "visible") !== false) {
				dbTables.push(i);
				this.parseTableColumns(data.definitions[i].properties, i);
			}
		}

		this.setState({
			tables: dbTables
		});

		// Load first table if no table is selected AND if there is no info available about pre-selected table
		if (dbTables[0] !== undefined && dbTables[0] !== null && dbTables[0] !== "" && this.state.table === "") {
			this.handleTableClick(dbTables[0]);
		} else {
			this.handleTableClick(this.state.table, true);
		}
	}

	// From JSON resp, extract the names of table columns and update state
	parseTableColumns(rawColProperties, table) {
		let columns = [];

		for (let i in rawColProperties) { // I = COLUMN in TABLE
			if (lib.getColumnConfig(this.state.dbIndex, table, i, "visible") !== false) {
				// list of columns for TABLE
				columns.push(i);

				let columnDefaultVisibility = lib.isColumnInDefaultView(this.state.dbIndex, table, i);

				// Each COLUMN's visibility stored in state
				if (columnDefaultVisibility === false) {
					this.setState({
						[table + i + "Visibility"]: "hide"
					});
				}
			}
		}

		// Save state
		this.setState({
			[table]: columns
		}, () => {
			if (table === this.state.table) {
				this.props.changeTable(this.state.table);
				this.props.changeColumns(this.state[this.state.table]);
				this.updateVisibleColumns();
			}
		});
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Handle click methods
	////////////////////////////////////////////////////////////////////////////////////////////////////

	// Set CLICKEDTABLE in state as TABLE
	handleTableClick(clickedTable, skipCheck = false) {
		// skipCheck prevents table schema collapse when leftPane toggles
		if (this.state.table !== clickedTable || skipCheck) {
			this.setState({
				table: clickedTable
			}, () => {
				this.props.changeTable(clickedTable);
				this.props.changeColumns(this.state[clickedTable]);
				this.updateVisibleColumns();
			});
		} else {
			this.setState({
				table: ""
			}, () => {
				this.props.changeTable("");
				this.props.changeColumns([]);
				this.updateVisibleColumns();
			});
		}
	}

	// Make a column visible or invisible on click
	handleColumnClick(column, table) {
		if (this.state[table + column + "Visibility"] === "hide") {
			this.setState({
				[table + column + "Visibility"]: ""
			}, () => {
				this.updateVisibleColumns();
			});
		} else {
			this.setState({
				[table + column + "Visibility"]: "hide"
			}, () => {
				this.updateVisibleColumns();
			});
		}
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Create HTML Elements
	////////////////////////////////////////////////////////////////////////////////////////////////////

	createTableElement(tableName) {
		const truncTextStyle = {
			textOverflow: 'clip',
			overflow: 'hidden',
			width: '29%',
			height: 20
		};

		let tableRename = lib.getTableConfig(this.state.dbIndex, tableName, "rename");
		let displayName = tableRename ? tableRename : tableName;

		let tableColumnElements = [];

		// First push the table itself
		tableColumnElements.push(
			<ListItem button key={tableName} id={tableName}
				 title={displayName} onClick={(event) => this.handleTableClick(tableName)}>
				<ListItemIcon>
					{this.state.table === tableName ? <FolderIconOpen className={this.props.classes.contrastColoured} /> : <FolderIcon /> }
				</ListItemIcon>
				<ListItemText primary={displayName} style={truncTextStyle} />
			</ListItem>
		);

		// Now push each column as hidden until state.table equals table tableName...
		for (let i in this.state[tableName]) {
			let columnName = this.state[tableName][i];
			tableColumnElements.push(this.createColumnElement(columnName, tableName));
		}

		return tableColumnElements;
	}

	createColumnElement(columnName, table) {
		let columnRename = lib.getColumnConfig(this.state.dbIndex, table, columnName, "rename");
		let displayName = columnRename ? columnRename : columnName;

		let visibility = this.state[table + columnName + "Visibility"] === "hide" ? false : true;

		// If TABLE is equal to STATE.TABLE (displayed table), show the column element
		let classNames = this.props.classes.column;
		if (this.state.table !== table) {
			classNames = this.props.classes.column + " " + this.props.classes.hide;
		}

		return (
			<ListItem button key={columnName} id={columnName}
				 title={displayName} className={classNames} onClick={(event) => this.handleColumnClick(columnName, table)}>
				<ListItemIcon>
					{visibility ? <VisibilityIcon className={this.props.classes.contrastColoured} /> : <VisibilityOffIcon /> }
				</ListItemIcon>
				<ListItemText secondary={displayName} />
			</ListItem>
		);
	}

	showTables() {
		let tableElements = [];
		for (let i = 0; i < this.state.tables.length; i++) {
			let tableName = this.state.tables[i];

			// For each table, push TABLE + COLUMN elements
			tableElements.push(
				this.createTableElement(tableName)
			);
		}
		return tableElements;
	}

	handleRequestClose = () => {
		this.setState({ snackBarVisibility: false });
	};

	updateVisibleColumns() {
		let columns = this.state[this.state.table];
		let columnVisibility = {};
		let visibleColumns = [];

		if (columns !== undefined) {
			for (let i = 0; i < columns.length; i++) {
				let visibility = this.state[this.state.table + columns[i] + "Visibility"] === "hide" ? false : true;
				columnVisibility[columns[i]] = visibility;
				if (visibility) {
					visibleColumns.push(columns[i]);
				}
			}
		}
		this.setState({
			[this.state.table + "visibleColumns"]: visibleColumns
		}, () => {
			this.props.changeVisibleColumns(this.state[this.state.table + "visibleColumns"]);
		});
	}

	render() {
		const classes = this.props.classes;
		return (
			<div>
				<Snackbar anchorOrigin={{vertical: "bottom", horizontal: "center"}} open={this.state.snackBarVisibility} onRequestClose={this.handleRequestClose} SnackbarContentProps={{ 'aria-describedby': 'message-id', }} message={<span id="message-id">{this.state.snackBarMessage}</span>} action={[ <IconButton key="close" aria-label="Close" color="accent" className={classes.close} onClick={this.handleRequestClose}> <CloseIcon /> </IconButton> ]} />
				<List>
					{ this.showTables() }
				</List>
			</div>
		);
	}
}

DbSchema.propTypes = {
	classes: PropTypes.object.isRequired,
};

const styleSheet = createStyleSheet(theme => ({
	column: {
		marginLeft: 27
	},
	hide: {
		display: 'none'
	},
	close: {
		width: theme.spacing.unit * 4,
		height: theme.spacing.unit * 4,
	},
	contrastColoured: {
		fill: indigo['400']
	}
}));

export default withStyles(styleSheet)(DbSchema);